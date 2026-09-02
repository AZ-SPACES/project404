package com.aza.backend.service;

import com.aza.backend.exception.AppException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Encrypts message bodies at rest with a key the server holds.
 *
 * <p>Chat history is readable by the server by design: a device that logs in
 * fresh has no key material of its own, so the server has to be able to hand it
 * the history (the Telegram cloud-chat / Instagram DM model). That deliberately
 * gives up end-to-end encryption. What it does <em>not</em> give up is
 * encryption at rest — a stolen database dump or a leaked backup is still
 * ciphertext, because the key lives in configuration rather than in the table.
 *
 * <p>Values are stored as {@code gcm1:<base64(nonce || ciphertext || tag)>}. The
 * prefix is a version marker, and its absence means "stored before this existed"
 * — those rows are passed through untouched, which is what keeps old support
 * messages (previously plaintext) readable.
 */
@Service
@Slf4j
public class MessageContentCipher {

    private static final String PREFIX = "gcm1:";
    private static final int NONCE_BYTES = 12;
    private static final int TAG_BITS = 128;

    private final SecretKey key;
    private final SecureRandom random = new SecureRandom();

    public MessageContentCipher(@Value("${app.chat.content-key:}") String base64Key) {
        if (base64Key == null || base64Key.isBlank()) {
            this.key = null;
            log.warn("app.chat.content-key is not set — chat message bodies will be stored "
                    + "UNENCRYPTED at rest. Set CHAT_CONTENT_KEY (base64 of 32 random bytes) "
                    + "in any environment holding real messages.");
            return;
        }
        byte[] raw;
        try {
            raw = Base64.getDecoder().decode(base64Key.trim());
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("app.chat.content-key is not valid base64", e);
        }
        if (raw.length != 32) {
            throw new IllegalStateException(
                    "app.chat.content-key must decode to exactly 32 bytes, got " + raw.length);
        }
        this.key = new SecretKeySpec(raw, "AES");
    }

    /** @return the value to persist, or null when there is nothing to store. */
    public String encrypt(String plaintext) {
        if (plaintext == null) return null;
        if (key == null) return plaintext;
        try {
            byte[] nonce = new byte[NONCE_BYTES];
            random.nextBytes(nonce);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, nonce));
            byte[] ct = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

            byte[] out = new byte[nonce.length + ct.length];
            System.arraycopy(nonce, 0, out, 0, nonce.length);
            System.arraycopy(ct, 0, out, nonce.length, ct.length);
            return PREFIX + Base64.getEncoder().encodeToString(out);
        } catch (Exception e) {
            throw new AppException("Failed to encrypt message content", e);
        }
    }

    /**
     * Reverses {@link #encrypt}. A value without the version prefix predates
     * at-rest encryption and is returned unchanged.
     */
    public String decrypt(String stored) {
        if (stored == null || !stored.startsWith(PREFIX)) return stored;
        if (key == null) {
            // The rows are encrypted but the key is gone — surface it rather than
            // handing the client a base64 blob to render as a message body.
            log.error("Encrypted message content found but app.chat.content-key is not set");
            return null;
        }
        try {
            byte[] blob = Base64.getDecoder().decode(stored.substring(PREFIX.length()));
            if (blob.length <= NONCE_BYTES) return null;

            byte[] nonce = new byte[NONCE_BYTES];
            System.arraycopy(blob, 0, nonce, 0, NONCE_BYTES);
            byte[] ct = new byte[blob.length - NONCE_BYTES];
            System.arraycopy(blob, NONCE_BYTES, ct, 0, ct.length);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, nonce));
            return new String(cipher.doFinal(ct), StandardCharsets.UTF_8);
        } catch (Exception e) {
            // A body we cannot read must not take down the whole history page.
            log.error("Failed to decrypt message content: {}", e.getMessage());
            return null;
        }
    }
}
