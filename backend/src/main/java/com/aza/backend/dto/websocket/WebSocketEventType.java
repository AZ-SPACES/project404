package com.aza.backend.dto.websocket;


import lombok.Getter;

@Getter
public enum WebSocketEventType {

    // Chat — durable except typing, which is only meaningful while it is being typed.
    CHAT_MESSAGE("chat.message", true),
    CHAT_MESSAGE_EDITED("chat.message.edited", true),
    CHAT_MESSAGE_DELETED("chat.message.deleted", true),
    CHAT_MEDIA_VIEWED("chat.media.viewed", true),
    CHAT_DISAPPEARING_UPDATED("chat.disappearing.updated", true),
    CHAT_SCREENSHOT("chat.screenshot", true),
    CHAT_TYPING("chat.typing", false),
    CHAT_READ("chat.read", true),
    CHAT_DELIVERED("chat.delivered", true),

    // Presence — a replayed "online" is a lie by the time it is read.
    USER_ONLINE("user.online", false),
    USER_OFFLINE("user.offline", false),

    // Call signaling — replaying it would ring the phone for a call that is
    // long over, and SDP/ICE for a dead peer connection is worse than nothing.
    CALL_INITIATE("call.initiate", false),
    CALL_WAITING("call.waiting", false),
    CALL_RINGING("call.ringing", false),
    CALL_ACCEPT("call.accept", false),
    CALL_DECLINE("call.decline", false),
    CALL_END("call.end", false),
    CALL_MISSED("call.missed", false),
    CALL_UPGRADE_REQUEST("call.upgrade.request", false),
    CALL_UPGRADE_ACCEPTED("call.upgrade.accepted", false),
    CALL_UPGRADE_DECLINED("call.upgrade.declined", false),
    CALL_RECONNECTING("call.reconnecting", false),
    CALL_RECONNECTED("call.reconnected", false),
    SDP_OFFER("sdp.offer", false),
    SDP_ANSWER("sdp.answer", false),
    ICE_CANDIDATE("ice.candidate", false),

    // Payment Requests
    PAYMENT_REQUEST_RECEIVED("payment.request.received", true),
    PAYMENT_REQUEST_PAID("payment.request.paid", true),
    PAYMENT_REQUEST_DECLINED("payment.request.declined", true),
    PAYMENT_REQUEST_CANCELLED("payment.request.cancelled", true),
    PAYMENT_REQUEST_EXPIRED("payment.request.expired", true),

    // Admin support inbox — a shared broadcast topic, not a per-user queue, so
    // there is no per-user cursor to replay it against.
    SUPPORT_NEW_MESSAGE("support.new_message", false),
    SUPPORT_CHAT_UPDATED("support.chat_updated", false),
    SUPPORT_BOT_TYPING("support.bot_typing", false),
    SUPPORT_HANDOFF("support.handoff", false),

    // QR Login — deliberately not retained: it authorizes a session, and the
    // approval is only valid for the seconds the login screen is waiting.
    QR_LOGIN_APPROVED("qr.login.approved", false),

    // Replay control — sent to a reconnecting client whose cursor has fallen
    // outside the retained event log, telling it to reload from REST history
    // and adopt the cursor carried in the payload.
    RESYNC_REQUIRED("resync.required", false),

    // System
    TRANSFER_UPDATE("transfer.update", true),
    NOTIFICATION_NEW("notification.new", true);

    private final String value;

    /**
     * Whether a client that was offline when this fired still needs it on
     * reconnect. Durable events are appended to the recipient's Redis Stream
     * ({@link com.aza.backend.service.WebSocketEventLog}) and replayed from the
     * client's cursor; ephemeral ones are delivered live or not at all.
     */
    private final boolean durable;

    WebSocketEventType(String value, boolean durable) {
        this.value = value;
        this.durable = durable;
    }

}
