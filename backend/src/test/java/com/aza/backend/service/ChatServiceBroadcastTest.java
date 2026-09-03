package com.aza.backend.service;

import com.aza.backend.dto.chat.MessageResponse;
import com.aza.backend.dto.chat.SendMessageRequest;
import com.aza.backend.entity.Chat;
import com.aza.backend.entity.ChatMessage;
import com.aza.backend.entity.User;
import com.aza.backend.dto.websocket.WebSocketEventType;
import com.aza.backend.repository.BlockedUserRepository;
import com.aza.backend.repository.ChatMessageRepository;
import com.aza.backend.repository.ChatRepository;
import com.aza.backend.repository.MessageCiphertextRepository;
import com.aza.backend.repository.PaymentRequestRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.util.CloudinaryService;
import com.aza.backend.util.RateLimitService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.Base64;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * A chat frame is fanned out to both participants, but part of what it says is
 * relative to whoever is reading it. {@code isSelf} is the whole of that part,
 * and it drives which side of the thread the bubble lands on, whether the
 * unread badge moves, and whether the reader answers with a delivery receipt.
 *
 * <p>Broadcasting the sender's own copy to both sides therefore told the
 * recipient the message was theirs: it drew on the wrong side, raised no badge,
 * and sent no receipt — which left the sender watching a single tick that could
 * never become two. These tests pin the payload to the participant it is for.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ChatServiceBroadcastTest {

    @Mock private ChatRepository chatRepository;
    @Mock private ChatMessageRepository chatMessageRepository;
    @Mock private MessageCiphertextRepository messageCiphertextRepository;
    @Mock private UserRepository userRepository;
    @Mock private WebSocketPublisher webSocketPublisher;
    @Mock private PresenceService presenceService;
    @Mock private NotificationService notificationService;
    @Mock private CloudinaryService cloudinaryService;
    @Mock private RateLimitService rateLimitService;
    @Mock private BlockedUserRepository blockedUserRepository;
    @Mock private PaymentRequestRepository paymentRequestRepository;

    private ChatService chatService;

    private final UUID senderId = UUID.randomUUID();
    private final UUID recipientId = UUID.randomUUID();
    private final UUID chatId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        byte[] raw = new byte[32];
        java.util.Arrays.fill(raw, (byte) 7);
        MessageContentCipher cipher =
                new MessageContentCipher(Base64.getEncoder().encodeToString(raw));

        chatService = new ChatService(
                chatRepository, chatMessageRepository, messageCiphertextRepository,
                userRepository, webSocketPublisher, presenceService, notificationService,
                cloudinaryService, rateLimitService, blockedUserRepository,
                paymentRequestRepository, cipher);

        when(chatMessageRepository.save(any(ChatMessage.class))).thenAnswer(inv -> {
            ChatMessage m = inv.getArgument(0);
            if (m.getId() == null) m.setId(UUID.randomUUID());
            return m;
        });
        when(blockedUserRepository.existsBlockBetween(any(), any())).thenReturn(false);
    }

    private Chat chat() {
        return Chat.builder()
                .id(chatId)
                .participantOneId(senderId)
                .participantTwoId(recipientId)
                .build();
    }

    private User sender() {
        User u = new User();
        u.setId(senderId);
        u.setFirstName("Ama");
        u.setLastName("Mensah");
        return u;
    }

    private SendMessageRequest request(String body) {
        SendMessageRequest r = new SendMessageRequest();
        r.setChatId(chatId);
        r.setType("TEXT");
        r.setContent(body);
        r.setClientId("c1");
        return r;
    }

    @SuppressWarnings("unchecked")
    private ArgumentCaptor<Function<UUID, Object>> capturePerRecipient(WebSocketEventType type) {
        ArgumentCaptor<Function<UUID, Object>> captor =
                ArgumentCaptor.forClass(Function.class);
        verify(webSocketPublisher).publishToChatRoom(
                eq(senderId), eq(recipientId), eq(type), captor.capture());
        return captor;
    }

    @Test
    void aNewMessageIsSelfOnlyForItsSender() {
        chatService.sendMessage(sender(), chat(), request("on my way"));

        Function<UUID, Object> payloadFor =
                capturePerRecipient(WebSocketEventType.CHAT_MESSAGE).getValue();

        MessageResponse toSender = (MessageResponse) payloadFor.apply(senderId);
        MessageResponse toRecipient = (MessageResponse) payloadFor.apply(recipientId);

        assertTrue(toSender.getIsSelf(), "the sender's own echo is theirs");
        assertFalse(toRecipient.getIsSelf(),
                "the recipient must not be told the incoming message is their own");

        // Everything viewer-independent still has to survive being split in two.
        assertEquals("on my way", toRecipient.getContent());
        assertEquals(senderId.toString(), toRecipient.getSenderId());
        assertEquals(toSender.getId(), toRecipient.getId());
    }

    @Test
    void anEditIsSelfOnlyForTheAuthor() {
        ChatMessage stored = ChatMessage.builder()
                .id(UUID.randomUUID())
                .chatId(chatId)
                .senderId(senderId)
                .type(ChatMessage.MessageType.TEXT)
                .status(ChatMessage.MessageStatus.SENT)
                .build();
        when(chatMessageRepository.findById(stored.getId())).thenReturn(Optional.of(stored));
        when(chatRepository.findById(chatId)).thenReturn(Optional.of(chat()));

        chatService.editMessage(sender(), stored.getId(), null, "on my way now");

        Function<UUID, Object> payloadFor =
                capturePerRecipient(WebSocketEventType.CHAT_MESSAGE_EDITED).getValue();

        assertTrue(((MessageResponse) payloadFor.apply(senderId)).getIsSelf());
        assertFalse(((MessageResponse) payloadFor.apply(recipientId)).getIsSelf(),
                "an edit does not change who wrote the message");
    }
}
