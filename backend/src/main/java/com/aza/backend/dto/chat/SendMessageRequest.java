package com.aza.backend.dto.chat;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class SendMessageRequest {

    @NotNull(message = "Chat ID is required")
    private UUID chatId;

    /**
     * The encrypted message ciphertext.
     * Server stores this opaquely — cannot read the content.
     */
    @NotBlank(message = "Ciphertext is required")
    private String ciphertext;

    /**
     * X3DH ephemeral public key.
     * Only required on the FIRST message in a new E2EE session.
     * Null for subsequent messages.
     */
    private String ephemeralKey;

    /**
     * Which one-time pre-key was used during X3DH.
     * Only required on the first message.
     */
    private String preKeyId;

    /**
     * Message type — defaults to TEXT.
     */
    private String type = "TEXT";

    /**
     * S3 key for encrypted media attachment.
     * Only set for IMAGE, VIDEO, DOCUMENT, VOICE_NOTE messages.
     */
    private String mediaKey;
}
