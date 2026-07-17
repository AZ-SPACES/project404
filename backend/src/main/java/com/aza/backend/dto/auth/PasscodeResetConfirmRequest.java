package com.aza.backend.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/** Step 2 of a forgot-passcode reset: the emailed OTP plus the new passcode. */
@Data
public class PasscodeResetConfirmRequest {

    @NotBlank(message = "Verification code is required")
    private String code;

    @NotBlank(message = "New passcode is required")
    @Size(min = 4, max = 4, message = "Passcode must be exactly 4 digits")
    private String newPasscode;
}
