package com.aza.backend.util;

import com.aza.backend.exception.AppException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Mirrors the rules in the app's CreatePasscodeScreen. If the two drift, a passcode the
 * app rejects would be accepted by a direct API call — which is the whole point of
 * having this copy.
 */
class PasscodePolicyTest {

    private String rejectionFor(String passcode) {
        AppException ex = assertThrows(AppException.class, () -> PasscodePolicy.validate(passcode),
                "expected rejection: " + passcode);
        assertEquals("WEAK_PASSCODE", ex.getCode());
        return ex.getMessage();
    }

    @Test
    void rejectsMalformedPasscodes() {
        for (String bad : new String[]{null, "", "123", "12345", "12a4", "  12", "১২৩৪"}) {
            rejectionFor(bad);
        }
    }

    @Test
    void rejectsRepeatedDigits() {
        for (String bad : new String[]{"0000", "1111", "9999"}) {
            rejectionFor(bad);
        }
    }

    @Test
    void rejectsSequencesInEitherDirection() {
        for (String bad : new String[]{"0123", "1234", "2345", "6789", "9876", "4321", "3210"}) {
            assertEquals("Passcodes cannot be common sequences.", rejectionFor(bad));
        }
    }

    @Test
    void rejectsThreeOrMoreOfTheSameDigit() {
        for (String bad : new String[]{"1112", "1211", "2111", "1011"}) {
            rejectionFor(bad);
        }
    }

    @Test
    void rejectsAlternatingAndPairedShapes() {
        // What people pick when told "not all the same, not a sequence".
        for (String bad : new String[]{"1212", "9090", "1122", "2211", "8877"}) {
            rejectionFor(bad);
        }
    }

    @Test
    void acceptsAReasonablePasscode() {
        for (String ok : new String[]{"1837", "2604", "9142", "5083", "1902"}) {
            assertDoesNotThrow(() -> PasscodePolicy.validate(ok), "expected accepted: " + ok);
        }
    }
}
