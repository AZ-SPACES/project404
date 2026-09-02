package com.aza.backend.service;

import com.aza.backend.dto.chat.MessageResponse;
import com.aza.backend.dto.chat.SendMessageRequest;
import com.aza.backend.entity.Chat;
import com.aza.backend.entity.ChatMessage;
import com.aza.backend.entity.User;
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
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.when;

/**
 * Covers the promise the server-readable-history change makes: a message body
 * is stored so the server can hand it to <em>any</em> device that logs in, but
 * is never sitting in the table as plaintext — and a body that is deleted or
 * expires is really gone, not merely hidden from one client.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ChatServiceMessageBodyTest {

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
    private MessageContentCipher cipher;

    private final UUID senderId = UUID.randomUUID();
    private final UUID recipientId = UUID.randomUUID();
    private final UUID chatId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        byte[] raw = new byte[32];
        java.util.Arrays.fill(raw, (byte) 3);
        // A real cipher, not a mock — the round trip is the thing under test.
        cipher = new MessageContentCipher(Base64.getEncoder().encodeToString(raw));

        chatService = new ChatService(
                chatRepository, chatMessageRepository, messageCiphertextRepository,
                userRepository, webSocketPublisher, presenceService, notificationService,
                cloudinaryService, rateLimitService, blockedUserRepository,
                paymentRequestRepository, cipher);

        // Persist returns what it was handed, with an id — as JPA would.
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

    @Test
    void storesTheBodyEncryptedButReturnsItReadable() {
        String body = "see you at the market";

        MessageResponse response = chatService.sendMessage(sender(), chat(), request(body));

        ArgumentCaptor<ChatMessage> saved = ArgumentCaptor.forClass(ChatMessage.class);
        org.mockito.Mockito.verify(chatMessageRepository).save(saved.capture());
        String persisted = saved.getValue().getContent();

        assertNotEquals(body, persisted, "the row must not hold the plaintext");
        assertTrue(persisted.startsWith("gcm1:"), "the row must hold an encrypted body");
        assertEquals(body, cipher.decrypt(persisted), "and it must decrypt back");

        // What a client receives — including a device that holds no key material
        // of its own — is the readable body.
        assertEquals(body, response.getContent());
    }

    @Test
    void aDeviceWithNoKeysCanReadTheHistoryPage() {
        // The whole point of the change: history is fetched, not decrypted
        // locally, so a freshly linked device sees the same text.
        ChatMessage stored = ChatMessage.builder()
                .id(UUID.randomUUID())
                .chatId(chatId)
                .senderId(recipientId)
                .type(ChatMessage.MessageType.TEXT)
                .status(ChatMessage.MessageStatus.SENT)
                .content(cipher.encrypt("sent before this phone existed"))
                .build();

        when(chatRepository.findById(chatId)).thenReturn(Optional.of(chat()));
        when(chatMessageRepository.findByChatId(any(), any()))
                .thenReturn(new org.springframework.data.domain.PageImpl<>(List.of(stored)));
        when(messageCiphertextRepository.findByMessageIdIn(anyList())).thenReturn(List.of());

        User newDevice = sender();
        var page = chatService.getMessages(newDevice, chatId, 0, 20);

        assertEquals(1, page.getContent().size());
        assertEquals("sent before this phone existed", page.getContent().getFirst().getContent());
    }

    @Test
    void deletingAMessageRemovesTheServerReadableBody() {
        ChatMessage stored = ChatMessage.builder()
                .id(UUID.randomUUID())
                .chatId(chatId)
                .senderId(senderId)
                .type(ChatMessage.MessageType.TEXT)
                .status(ChatMessage.MessageStatus.SENT)
                .content(cipher.encrypt("regrettable"))
                .build();
        when(chatMessageRepository.findById(stored.getId())).thenReturn(Optional.of(stored));

        chatService.deleteMessage(sender(), stored.getId());

        assertNull(stored.getContent(),
                "a deleted body must not survive for the next device that loads history");
        assertTrue(Boolean.TRUE.equals(stored.getIsDeleted()));
    }

    @Test
    void expiredMessagesLoseTheirBodyToo() {
        ChatMessage stored = ChatMessage.builder()
                .id(UUID.randomUUID())
                .chatId(chatId)
                .senderId(senderId)
                .type(ChatMessage.MessageType.TEXT)
                .status(ChatMessage.MessageStatus.SENT)
                .content(cipher.encrypt("disappearing"))
                .build();
        when(chatMessageRepository.findExpiredMessages(any())).thenReturn(List.of(stored));
        when(chatRepository.findById(chatId)).thenReturn(Optional.of(chat()));

        chatService.purgeExpiredMessages();

        assertNull(stored.getContent(), "a disappearing message must actually disappear");
    }

    @Test
    void aDeletedMessageIsNeverHandedBackWithABody() {
        ChatMessage deleted = ChatMessage.builder()
                .id(UUID.randomUUID())
                .chatId(chatId)
                .senderId(senderId)
                .type(ChatMessage.MessageType.TEXT)
                .status(ChatMessage.MessageStatus.SENT)
                .isDeleted(true)
                .content(cipher.encrypt("should never surface"))
                .build();

        when(chatRepository.findById(chatId)).thenReturn(Optional.of(chat()));
        when(chatMessageRepository.findByChatId(any(), any()))
                .thenReturn(new org.springframework.data.domain.PageImpl<>(List.of(deleted)));
        when(messageCiphertextRepository.findByMessageIdIn(anyList())).thenReturn(List.of());

        var page = chatService.getMessages(sender(), chatId, 0, 20);

        assertNull(page.getContent().getFirst().getContent(),
                "a row still carrying a body must not leak it once flagged deleted");
    }
}
