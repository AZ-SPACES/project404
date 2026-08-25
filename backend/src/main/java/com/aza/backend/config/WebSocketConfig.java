package com.aza.backend.config;

import com.aza.backend.websocket.interceptor.WebSocketAuthInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final WebSocketAuthInterceptor webSocketAuthInterceptor;

    @Value("${app.websocket.max-text-message-size:65536}")
    private int maxTextMessageSize;

    @Value("${app.websocket.max-binary-message-size:524288}")
    private int maxBinaryMessageSize;

    @Value("${app.allowed-origins:http://localhost:3000}")
    private String allowedOrigins;

    /**
     * Threads handling inbound STOMP frames. Spring's default is
     * {@code 2 x availableProcessors} with an unbounded queue — and an
     * unbounded queue means a ThreadPoolExecutor never grows past its core
     * size, so on a 2-vCPU droplet every chat.send, typing indicator and
     * heartbeat in the system shared four threads. Each chat.send holds one
     * for a whole DB transaction, so a burst of messages queued behind each
     * other instead of running concurrently. The work here is I/O-bound
     * (waiting on Postgres), not CPU-bound, so more threads than cores is
     * correct; the DB connection pool remains the real limit, and queuing at
     * Hikari rather than at the channel keeps non-DB frames flowing.
     */
    @Value("${app.websocket.inbound-pool-size:16}")
    private int inboundPoolSize;

    @Value("${app.websocket.outbound-pool-size:16}")
    private int outboundPoolSize;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic", "/queue");
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
        registry.configureBrokerChannel().taskExecutor()
                .corePoolSize(outboundPoolSize)
                .maxPoolSize(outboundPoolSize * 2)
                .queueCapacity(500);
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Endpoint for both native (raw WS) and web (SockJS) clients
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")
                .withSockJS();

        // SockJS endpoint for web clients that need HTTP fallback
        registry.addEndpoint("/ws/chat")
                .setAllowedOriginPatterns(allowedOrigins.split(","))
                .withSockJS();
    }

    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
        registration.setMessageSizeLimit(maxTextMessageSize);
        registration.setSendBufferSizeLimit(maxBinaryMessageSize);
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(webSocketAuthInterceptor);
        registration.taskExecutor()
                .corePoolSize(inboundPoolSize)
                .maxPoolSize(inboundPoolSize * 2)
                .queueCapacity(200);
    }

    /**
     * Threads writing frames out to client sockets. A slow or backpressured
     * client holds one for the duration of its write, so this pool must not be
     * the four-thread default either — one stalled phone should not delay
     * delivery to everyone else.
     */
    @Override
    public void configureClientOutboundChannel(ChannelRegistration registration) {
        registration.taskExecutor()
                .corePoolSize(outboundPoolSize)
                .maxPoolSize(outboundPoolSize * 2)
                .queueCapacity(500);
    }
}
