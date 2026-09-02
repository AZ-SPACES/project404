package com.aza.backend.dto.chat;

import lombok.Data;

@Data
public class EditMessageRequest {

    /**
     * New message body in the clear. Stored server-readable (encrypted at rest)
     * so every device on the account sees the edit, including ones that were not
     * linked when the message was first sent.
     */
    private String content;

    /**
     * New encrypted ciphertext — must use the same E2EE session key as the
     * original. Retained for clients built before the move to server-readable
     * history; at least one of {@code content} or {@code ciphertext} is required,
     * which {@code ChatService.editMessage} enforces.
     */
    private String ciphertext;
}
