package com.aza.backend.service;

import com.aza.backend.dto.chat.MessageResponse;
import com.aza.backend.dto.websocket.WebSocketEventType;
import com.aza.backend.entity.Chat;
import com.aza.backend.entity.ChatMessage;
import com.aza.backend.entity.User;
import com.aza.backend.repository.ChatMessageRepository;
import com.aza.backend.repository.ChatRepository;
import com.aza.backend.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class SupportBotProcessor {

    private final AiService aiService;
    private final ChatRepository chatRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final UserRepository userRepository;
    private final WebSocketPublisher webSocketPublisher;
    private final ObjectMapper objectMapper;

    @Async("taskExecutor")
    @Transactional
    public void generateAndReply(UUID chatId, UUID userId) {
        try {
            Chat chat = chatRepository.findById(chatId).orElse(null);
            if (chat == null || !Boolean.TRUE.equals(chat.getBotActive())) return;

            User user = userRepository.findById(userId).orElse(null);

            // Send bot typing indicator
            webSocketPublisher.publishToChatRoom(
                    chat.getParticipantOneId(), chat.getParticipantTwoId(),
                    WebSocketEventType.SUPPORT_BOT_TYPING,
                    Map.of("chatId", chatId.toString(), "isTyping", true, "isSelf", false));

            // Build conversation history (newest-last order for Claude)
            List<ChatMessage> recentMessages = chatMessageRepository
                    .findByChatId(chatId, PageRequest.of(0, 15))
                    .getContent()
                    .reversed();

            List<Map<String, String>> history = new ArrayList<>();
            for (ChatMessage m : recentMessages) {
                boolean isUser = userId.equals(m.getSenderId());
                String role = isUser ? "user" : "assistant";
                if (m.getContent() != null && !m.getContent().isBlank()) {
                    history.add(Map.of("role", role, "content", m.getContent()));
                }
            }

            String userContext = buildUserContext(user, chat);
            String jsonResponse = aiService.supportBotReply(userId, userContext, history, 400);

            if (jsonResponse == null) {
                log.warn("Bot returned null for chat {}", chatId);
                return;
            }

            BotReply parsed = parseReply(jsonResponse);
            if (parsed == null || parsed.reply().isBlank()) return;

            // Stop typing indicator
            webSocketPublisher.publishToChatRoom(
                    chat.getParticipantOneId(), chat.getParticipantTwoId(),
                    WebSocketEventType.SUPPORT_BOT_TYPING,
                    Map.of("chatId", chatId.toString(), "isTyping", false, "isSelf", false));

            // Save bot message
            ChatMessage botMsg = ChatMessage.builder()
                    .chatId(chatId)
                    .senderId(chat.getParticipantTwoId())
                    .content(parsed.reply())
                    .type(ChatMessage.MessageType.TEXT)
                    .status(ChatMessage.MessageStatus.SENT)
                    .isBot(true)
                    .isAdminReply(true)
                    .build();
            botMsg = chatMessageRepository.save(botMsg);
            chat.setLastMessageAt(LocalDateTime.now());

            // Auto-escalate if bot signals it or detects urgent keywords
            if (parsed.escalate()) {
                chat.setStatus(Chat.ChatStatus.PENDING);
                chat.setPriority(Chat.Priority.HIGH);
                chatRepository.save(chat);
                webSocketPublisher.publishToAdminSupport(
                        WebSocketEventType.SUPPORT_CHAT_UPDATED,
                        buildSummary(chat, user));
            } else {
                chatRepository.save(chat);
            }

            // Deliver to user via WebSocket
            MessageResponse msgResponse = toResponse(botMsg);
            webSocketPublisher.publishToChatRoom(
                    chat.getParticipantOneId(), chat.getParticipantTwoId(),
                    WebSocketEventType.CHAT_MESSAGE, msgResponse);

        } catch (Exception e) {
            log.warn("Bot processor error for chat {}: {}", chatId, e.getMessage());
        }
    }

    private String buildUserContext(User user, Chat chat) {
        StringBuilder sb = new StringBuilder("User context:\n");
        if (user != null) {
            sb.append("- Name: ").append(user.getFirstName()).append(" ").append(user.getLastName()).append("\n");
            sb.append("- Account status: ").append(user.getStatus()).append("\n");
            sb.append("- KYC status: ").append(user.getKycStatus()).append("\n");
        }
        if (chat.getCategory() != null) {
            sb.append("- Support category: ").append(chat.getCategory()).append("\n");
        }
        return sb.toString();
    }

    private BotReply parseReply(String json) {
        try {
            // Claude sometimes wraps the JSON in markdown fences — strip them
            String cleaned = json.strip();
            if (cleaned.startsWith("```")) {
                cleaned = cleaned.replaceAll("```[a-z]*\\n?", "").replace("```", "").strip();
            }
            JsonNode root = objectMapper.readTree(cleaned);
            String reply = root.path("reply").asText("").strip();
            boolean escalate = root.path("escalate").asBoolean(false);
            return new BotReply(reply, escalate);
        } catch (Exception e) {
            // If JSON parse fails, treat the whole response as the reply
            return new BotReply(json.strip(), false);
        }
    }

    private MessageResponse toResponse(ChatMessage m) {
        return MessageResponse.builder()
                .id(m.getId().toString())
                .chatId(m.getChatId().toString())
                .senderId(m.getSenderId().toString())
                .content(m.getContent())
                .type(m.getType().name())
                .status(m.getStatus().name())
                .sentAt(m.getSentAt() != null ? m.getSentAt().toString() : LocalDateTime.now().toString())
                .isDeleted(false)
                .isSelf(false)
                .isBot(true)
                .build();
    }

    private Map<String, Object> buildSummary(Chat chat, User user) {
        return Map.of(
                "chatId", chat.getId().toString(),
                "userId", chat.getParticipantOneId().toString(),
                "userName", user != null ? user.getFirstName() + " " + user.getLastName() : "Unknown",
                "status", chat.getStatus().name(),
                "priority", chat.getPriority().name(),
                "botActive", Boolean.TRUE.equals(chat.getBotActive())
        );
    }

    public record BotReply(String reply, boolean escalate) {}
}
