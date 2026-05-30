package com.aza.backend.dto.websocket;


import lombok.Getter;

@Getter
public enum WebSocketEventType {

    // Chat
    CHAT_MESSAGE("chat.message"),
    CHAT_MESSAGE_EDITED("chat.message.edited"),
    CHAT_MESSAGE_DELETED("chat.message.deleted"),
    CHAT_MEDIA_VIEWED("chat.media.viewed"),
    CHAT_DISAPPEARING_UPDATED("chat.disappearing.updated"),
    CHAT_TYPING("chat.typing"),
    CHAT_READ("chat.read"),
    CHAT_DELIVERED("chat.delivered"),

    // Presence
    USER_ONLINE("user.online"),
    USER_OFFLINE("user.offline"),

    // Call signaling
    CALL_INITIATE("call.initiate"),
    CALL_WAITING("call.waiting"),
    CALL_RINGING("call.ringing"),
    CALL_ACCEPT("call.accept"),
    CALL_DECLINE("call.decline"),
    CALL_END("call.end"),
    CALL_MISSED("call.missed"),
    CALL_UPGRADE_REQUEST("call.upgrade.request"),
    CALL_UPGRADE_ACCEPTED("call.upgrade.accepted"),
    CALL_UPGRADE_DECLINED("call.upgrade.declined"),
    CALL_RECONNECTING("call.reconnecting"),
    CALL_RECONNECTED("call.reconnected"),
    SDP_OFFER("sdp.offer"),
    SDP_ANSWER("sdp.answer"),
    ICE_CANDIDATE("ice.candidate"),

    // Payment Requests
    PAYMENT_REQUEST_RECEIVED("payment.request.received"),
    PAYMENT_REQUEST_PAID("payment.request.paid"),
    PAYMENT_REQUEST_DECLINED("payment.request.declined"),
    PAYMENT_REQUEST_CANCELLED("payment.request.cancelled"),
    PAYMENT_REQUEST_EXPIRED("payment.request.expired"),

    // Admin support inbox
    SUPPORT_NEW_MESSAGE("support.new_message"),
    SUPPORT_CHAT_UPDATED("support.chat_updated"),
    SUPPORT_BOT_TYPING("support.bot_typing"),
    SUPPORT_HANDOFF("support.handoff"),

    // System
    TRANSFER_UPDATE("transfer.update"),
    NOTIFICATION_NEW("notification.new");

    private final String value;

    WebSocketEventType(String value) {
        this.value = value;
    }

}
