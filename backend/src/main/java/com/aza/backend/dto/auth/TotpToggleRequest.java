package com.aza.backend.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class TotpToggleRequest {

    @NotBlank(message = "Authenticator code is required")
    @Pattern(regexp = "\\d{6}", message = "Authenticator code must be exactly 6 digits")
    private String code;
}
