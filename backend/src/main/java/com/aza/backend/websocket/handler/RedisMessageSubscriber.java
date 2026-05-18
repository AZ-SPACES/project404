package com.aza.backend.websocket.handler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class RedisMessageSubscriber implements MessageListener {

    private final SimpMessagingTemplate messagingTemplate;

    @Override
    public void onMessage(Message message, byte[] pattern) {
        String channel = new String(message.getChannel());
        String payload = new String(message.getBody());

        try {
            if (channel.startsWith("aza:chat_user:")) {
                String userId = channel.replace("aza:chat_user:", "");
                messagingTemplate.convertAndSendToUser(userId, "/queue/chat", payload);

            } else if (channel.startsWith("aza:call:")) {
                String userId = channel.replace("aza:call:", "");
                messagingTemplate.convertAndSendToUser(userId, "/queue/calls", payload);

            } else if (channel.equals("aza:presence")) {
                messagingTemplate.convertAndSend("/topic/presence", payload);

            } else if (channel.startsWith("aza:notify:")) {
                String userId = channel.replace("aza:notify:", "");
                messagingTemplate.convertAndSendToUser(userId, "/queue/notifications", payload);

            } else if (channel.equals("aza:admin_support")) {
                messagingTemplate.convertAndSend("/topic/admin/support", payload);
            }

        } catch (Exception e) {
            log.error("Failed to forward Redis message from channel {}: {}", channel, e.getMessage());
        }
    }
}
