package com.aza.backend.dto.auth;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/** Step 1 of a forgot-passcode reset: re-authenticate with the account password. */
@Data
public class PasscodeResetRequest {

    @NotBlank(message = "Password is required")
    private String password;
}
