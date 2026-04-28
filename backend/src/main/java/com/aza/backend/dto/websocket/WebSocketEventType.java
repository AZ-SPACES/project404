package com.aza.backend.dto.websocket;


import lombok.Getter;

@Getter
public enum WebSocketEventType {

    // Chat
    CHAT_MESSAGE("chat.message"),
    CHAT_TYPING("chat.typing"),
    CHAT_READ("chat.read"),
    CHAT_DELIVERED("chat.delivered"),

    // Presence
    USER_ONLINE("user.online"),
    USER_OFFLINE("user.offline"),

    // Call signaling
    CALL_INITIATE("call.initiate"),
    CALL_RINGING("call.ringing"),
    CALL_ACCEPT("call.accept"),
    CALL_DECLINE("call.decline"),
    CALL_END("call.end"),
    CALL_MISSED("call.missed"),
    SDP_OFFER("sdp.offer"),
    SDP_ANSWER("sdp.answer"),
    ICE_CANDIDATE("ice.candidate"),

    // System
    TRANSFER_UPDATE("transfer.update"),
    NOTIFICATION_NEW("notification.new");

    private final String value;

    WebSocketEventType(String value) {
        this.value = value;
    }

}
