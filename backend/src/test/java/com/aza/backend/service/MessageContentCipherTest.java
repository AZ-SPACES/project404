package com.aza.backend.service;

import org.junit.jupiter.api.Test;

import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MessageContentCipherTest {

    private static String key(byte fill) {
        byte[] raw = new byte[32];
        java.util.Arrays.fill(raw, fill);
        return Base64.getEncoder().encodeToString(raw);
    }

    private static final MessageContentCipher CIPHER = new MessageContentCipher(key((byte) 7));

    @Test
    void roundTripsAMessageBody() {
        String body = "hey — meet at 6? 🎉";
        String stored = CIPHER.encrypt(body);

        assertTrue(stored.startsWith("gcm1:"), "stored value should carry the version prefix");
        assertEquals(body, CIPHER.decrypt(stored));
    }

    @Test
    void doesNotLeaveThePlaintextInTheStoredValue() {
        String stored = CIPHER.encrypt("transfer the 500 to Kwame");
        assertTrue(stored.indexOf("Kwame") < 0, "ciphertext must not contain the plaintext");
    }

    @Test
    void usesAFreshNoncePerCall() {
        // Same input twice must not produce the same stored value, or identical
        // messages would be linkable straight from a database dump.
        assertNotEquals(CIPHER.encrypt("same"), CIPHER.encrypt("same"));
    }

    @Test
    void passesThroughValuesWrittenBeforeAtRestEncryption() {
        // Old support-chat rows are bare plaintext with no prefix.
        assertEquals("legacy support message", CIPHER.decrypt("legacy support message"));
    }

    @Test
    void handlesNulls() {
        assertNull(CIPHER.encrypt(null));
        assertNull(CIPHER.decrypt(null));
    }

    @Test
    void returnsNullRatherThanGarbageForATamperedOrForeignValue() {
        String stored = CIPHER.encrypt("original");

        // Wrong key: GCM authentication fails.
        assertNull(new MessageContentCipher(key((byte) 9)).decrypt(stored));

        // Flipped byte in the body: authentication fails rather than decrypting.
        char[] chars = stored.toCharArray();
        int last = chars.length - 1;
        chars[last] = chars[last] == 'A' ? 'B' : 'A';
        assertNull(CIPHER.decrypt(new String(chars)));
    }

    @Test
    void storesInTheClearWhenNoKeyIsConfigured() {
        // Local dev convenience; the service logs a warning at startup.
        MessageContentCipher plain = new MessageContentCipher("");
        assertEquals("no key set", plain.encrypt("no key set"));
        assertEquals("no key set", plain.decrypt("no key set"));
    }

    @Test
    void rejectsAMisconfiguredKey() {
        assertThrows(IllegalStateException.class,
                () -> new MessageContentCipher(Base64.getEncoder().encodeToString(new byte[16])));
        assertThrows(IllegalStateException.class,
                () -> new MessageContentCipher("not base64!!"));
    }
}
