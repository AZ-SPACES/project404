package com.aza.backend.dto.chat;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class MessageResponse {
    private String id;
    private String chatId;
    private String senderId;
    /** Echo of SendMessageRequest.clientId — sender uses it to dedup its echo. */
    private String clientId;
    private String ciphertext;
    private String content;
    private String ephemeralKey;
    private String preKeyId;
    /** Sender's identity public key on the first message of a session; null otherwise. */
    private String senderIdentityPublicKey;
    private String type;
    private String status;
    private String sentAt;
    private String deliveredAt;
    private String readAt;
    private boolean isDeleted;
    private Boolean isSelf;
    private Boolean isBot;
    private Boolean isAdminReply;
    private String mediaKey;
    private boolean viewOnce;
    private String viewedAt;   // non-null = media has been consumed, mediaKey is gone
    private String editedAt;   // non-null = message was edited
    private String expiresAt;  // non-null = message will disappear at this time
    private PaymentRequestResponse paymentRequest; // non-null for type=PAYMENT_REQUEST
}
