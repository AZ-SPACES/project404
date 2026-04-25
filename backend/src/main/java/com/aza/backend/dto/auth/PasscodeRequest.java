package com.aza.backend.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class PasscodeRequest {

    @NotBlank(message = "Passcode is required")
    @Size(min = 5, max = 5, message = "Passcode must be exactly 5 digits")
    private String passcode;
}
