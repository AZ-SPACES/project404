package com.aza.backend.util;

import com.aza.backend.exception.AppException;
import org.springframework.http.HttpStatus;

/**
 * Strength rules for the 4-digit payment passcode.
 *
 * These rules existed only in the mobile app (CreatePasscodeScreen), which meant they
 * were advisory: a modified client or a direct API call could set 0000 on an account
 * that authorises money movement. This is the server-side copy, and it is the one that
 * counts. Keep the two in sync — the app should still reject weak codes as the user
 * types, because a rejection at submit time after the passcode has been entered twice
 * is a much worse experience than one shown immediately.
 *
 * Enforced on write only. Users who already hold a weak passcode keep working: failing
 * them at verify time would lock people out of their own money for a rule they never
 * agreed to, and they are prompted to change it, not stopped.
 */
public final class PasscodePolicy {

    private PasscodePolicy() {}

    private static final int LENGTH = 4;
    private static final String FORWARD = "0123456789";
    private static final String BACKWARD = "9876543210";

    private static final String TOO_SIMPLE = "Please choose a more complex passcode.";
    private static final String SEQUENCE = "Passcodes cannot be common sequences.";

    /**
     * @throws AppException with a user-facing message when the passcode is too weak.
     */
    public static void validate(String passcode) {
        // ASCII digits specifically, not Character.isDigit — that returns true for Bengali,
        // Devanagari and every other Unicode digit block, so "\u09E7\u09E8\u09E9\u09EA" would sail past
        // this check and then past every rule below it (four distinct characters, in no
        // sequence, no repeats). The app's numeric keypad cannot produce those, so anything
        // that does is not the app.
        if (passcode == null || passcode.length() != LENGTH || !isAsciiDigits(passcode)) {
            throw reject("Your passcode must be " + LENGTH + " digits.");
        }

        // All the same digit: 1111, 2222…
        if (passcode.chars().distinct().count() == 1) {
            throw reject(TOO_SIMPLE);
        }

        // Runs in either direction: 1234, 6789, 4321, 3210…
        if (FORWARD.contains(passcode) || BACKWARD.contains(passcode)) {
            throw reject(SEQUENCE);
        }

        // Any digit three or more times: 1112, 1211, 2111…
        for (char c : passcode.toCharArray()) {
            if (passcode.chars().filter(ch -> ch == c).count() >= 3) {
                throw reject(TOO_SIMPLE);
            }
        }

        // Alternating (1212) or two pairs (1122) — the shapes people reach for when
        // told "not all the same and not a sequence".
        boolean alternating = passcode.charAt(0) == passcode.charAt(2)
                && passcode.charAt(1) == passcode.charAt(3);
        boolean twoPairs = passcode.charAt(0) == passcode.charAt(1)
                && passcode.charAt(2) == passcode.charAt(3);
        if (alternating || twoPairs) {
            throw reject(TOO_SIMPLE);
        }
    }

    private static boolean isAsciiDigits(String value) {
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (c < '0' || c > '9') return false;
        }
        return true;
    }

    private static AppException reject(String message) {
        return new AppException("WEAK_PASSCODE", message, HttpStatus.BAD_REQUEST);
    }
}
