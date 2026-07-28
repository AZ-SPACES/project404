package com.aza.backend.util;

/**
 * Central phone-number normalization. Every identifier that might be a phone
 * number (signup, login, availability checks, SMS sending) must go through
 * {@link #normalize(String)} so the same user input always resolves to the
 * same stored value and the same rate-limit / OTP Redis keys.
 *
 * Canonical form is E.164 with a leading "+" (e.g. +233241234567).
 */
public final class PhoneNumberUtil {

    private PhoneNumberUtil() {}

    /** Ghana country code — the app's default market. */
    private static final String DEFAULT_CC = "233";

    /**
     * Normalize a phone number to E.164.
     *
     * Handles the three real-world Ghanaian input shapes:
     *   0241234567       → +233241234567   (local trunk format)
     *   +2330241234567   → +233241234567   (country code + redundant trunk zero,
     *                                       produced by clients that concatenate
     *                                       "+233" with a 0-prefixed local number)
     *   233241234567     → +233241234567   (missing "+")
     *
     * Inputs that don't look like a phone number are returned trimmed and
     * otherwise untouched, so email identifiers pass through safely.
     */
    public static String normalize(String phone) {
        if (phone == null) return null;
        String trimmed = phone.trim();
        if (trimmed.isEmpty() || trimmed.contains("@")) return trimmed;

        String digits = trimmed.replaceAll("\\D", "");
        if (digits.length() < 7 || digits.length() > 15) return trimmed;

        // Local Ghana format: 0XXXXXXXXX (10 digits, no country code)
        if (!trimmed.startsWith("+") && digits.length() == 10 && digits.startsWith("0")) {
            return "+" + DEFAULT_CC + digits.substring(1);
        }

        // Country code followed by a redundant trunk zero: 2330XXXXXXXXX.
        // A valid Ghana E.164 number is 233 + 9 digits = 12 digits, so a
        // 13-digit number starting 2330 is always this malformation.
        if (digits.startsWith(DEFAULT_CC + "0") && digits.length() == 13) {
            return "+" + DEFAULT_CC + digits.substring(4);
        }

        return "+" + digits;
    }

    /** True when the identifier looks like a phone number rather than an email. */
    public static boolean looksLikePhone(String identifier) {
        if (identifier == null) return false;
        String trimmed = identifier.trim();
        if (trimmed.isEmpty() || trimmed.contains("@")) return false;
        String digits = trimmed.replaceAll("\\D", "");
        return digits.length() >= 7 && digits.length() <= 15;
    }
}
