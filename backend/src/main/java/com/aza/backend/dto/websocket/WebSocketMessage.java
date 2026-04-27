package com.aza.backend.dto.websocket;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;


@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class WebSocketMessage {

    private String type;       // WebSocketEventType value e.g. "chat.message"
    private Object payload;    // event-specific data
    private String timestamp;  // ISO-8601 timestamp

    public static WebSocketMessage of(WebSocketEventType type, Object payload) {
        return WebSocketMessage.builder()
                .type(type.getValue())
                .payload(payload)
                .timestamp(java.time.LocalDateTime.now().toString())
                .build();
    }
}
