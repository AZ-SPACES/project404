package com.aza.backend.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class PasscodeChangeRequest {

    @NotBlank(message = "Current passcode is required")
    @Size(min = 4, max = 4, message = "Passcode must be exactly 4 digits")
    private String currentPasscode;

    @NotBlank(message = "New passcode is required")
    @Size(min = 4, max = 4, message = "Passcode must be exactly 4 digits")
    private String newPasscode;
}
