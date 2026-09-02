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

    /**
     * Redis Stream entry id ("<millis>-<seq>") of this event in the recipient's
     * event log, stamped on by {@link com.aza.backend.service.WebSocketEventLog}
     * just before delivery. It is the cursor the client sends back on
     * /app/resync to replay what it missed, and the key it dedupes on when a
     * replay overlaps events already delivered live.
     *
     * Null on ephemeral events (typing, presence, call signaling), which are
     * never logged and so are never replayed.
     */
    private String id;

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
