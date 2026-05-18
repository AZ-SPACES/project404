package com.aza.backend.service;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Encrypts and decrypts TOTP secrets stored in the database using AES-256-GCM.
 *
 * The key MUST be a Base64-encoded 32-byte (256-bit) value supplied via the
 * TOTP_ENCRYPTION_KEY environment variable. Generate one with:
 *   openssl rand -base64 32
 *
 * Wire format (all Base64-encoded as one string):
 *   [ 12-byte IV ][ N-byte GCM ciphertext + 16-byte auth tag ]
 */
@Service
public class TotpEncryptionService {

    private static final String ALGORITHM   = "AES/GCM/NoPadding";
    private static final int    IV_BYTES    = 12;
    private static final int    TAG_BITS    = 128;

    @Value("${app.totp.encryption-key}")
    private String keyBase64;

    private SecretKey secretKey;

    @PostConstruct
    void init() {
        byte[] keyBytes = Base64.getDecoder().decode(keyBase64);
        if (keyBytes.length != 32) {
            throw new IllegalStateException(
                    "app.totp.encryption-key must be a Base64-encoded 32-byte (256-bit) value");
        }
        secretKey = new SecretKeySpec(keyBytes, "AES");
    }

    public String encrypt(String plaintext) {
        try {
            byte[] iv = new byte[IV_BYTES];
            new SecureRandom().nextBytes(iv);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, new GCMParameterSpec(TAG_BITS, iv));
            byte[] ciphertext = cipher.doFinal(plaintext.getBytes());

            byte[] blob = new byte[IV_BYTES + ciphertext.length];
            System.arraycopy(iv, 0, blob, 0, IV_BYTES);
            System.arraycopy(ciphertext, 0, blob, IV_BYTES, ciphertext.length);
            return Base64.getEncoder().encodeToString(blob);
        } catch (Exception e) {
            throw new RuntimeException("Failed to encrypt TOTP secret", e);
        }
    }

    public String decrypt(String encoded) {
        try {
            byte[] blob = Base64.getDecoder().decode(encoded);
            byte[] iv   = new byte[IV_BYTES];
            System.arraycopy(blob, 0, iv, 0, IV_BYTES);
            byte[] ciphertext = new byte[blob.length - IV_BYTES];
            System.arraycopy(blob, IV_BYTES, ciphertext, 0, ciphertext.length);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE, secretKey, new GCMParameterSpec(TAG_BITS, iv));
            return new String(cipher.doFinal(ciphertext));
        } catch (Exception e) {
            throw new RuntimeException("Failed to decrypt TOTP secret", e);
        }
    }
}
