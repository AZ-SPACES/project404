package com.aza.backend.dto.chat;

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
    private String ciphertext;
    private String content;

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
     * Cloudinary URL for encrypted media attachment.
     * Only set for IMAGE, VIDEO, DOCUMENT, VOICE_NOTE messages.
     */
    private String mediaKey;

    /**
     * If true, the mediaKey is wiped server-side after the recipient views the media once.
     */
    private boolean viewOnce = false;

    /**
     * Sender-side correlation id. Optional. When set, the server persists it
     * unchanged and includes it in every MessageResponse it emits for this
     * message (REST response, WS echo to the sender, WS push to the peer).
     * Lets the sending client de-duplicate its own optimistic insert against
     * the eventual server echo without resorting to timing heuristics.
     *
     * Treated as opaque — the server never interprets the contents.
     */
    private String clientId;

    /**
     * Sender's identity X25519 public key, base64-encoded.
     * Only required on the FIRST message of a new E2EE session — the
     * recipient needs it to compute the X3DH DH1 (sender_IK · recipient_SPK)
     * without an extra round-trip to fetch the sender's key bundle.
     * Null on subsequent messages once the session root key is cached.
     */
    private String senderIdentityPublicKey;
}
