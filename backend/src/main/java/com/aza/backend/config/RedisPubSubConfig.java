package com.aza.backend.config;

import com.aza.backend.websocket.handler.RedisMessageSubscriber;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.PatternTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.data.redis.listener.adapter.MessageListenerAdapter;

@Configuration
public class RedisPubSubConfig {

    public static final String CHAT_USER_CHANNEL_PREFIX  = "aza:chat_user:";
    public static final String CALL_CHANNEL_PREFIX       = "aza:call:";
    public static final String PRESENCE_CHANNEL          = "aza:presence";
    public static final String NOTIFY_CHANNEL_PREFIX     = "aza:notify:";
    public static final String ADMIN_SUPPORT_CHANNEL     = "aza:admin_support";

    @Bean
    public RedisMessageListenerContainer redisMessageListenerContainer(
            RedisConnectionFactory connectionFactory,
            MessageListenerAdapter listenerAdapter) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);
        container.addMessageListener(listenerAdapter, new PatternTopic("aza:*"));
        return container;
    }

    @Bean
    public MessageListenerAdapter listenerAdapter(RedisMessageSubscriber subscriber) {
        return new MessageListenerAdapter(subscriber, "onMessage");
    }
}
