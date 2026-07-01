package com.aza.backend.dto.merchant;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ConfirmCheckoutRequest {

    @NotBlank
    @Size(min = 4, max = 4, message = "Passcode must be exactly 4 digits")
    private String passcode;
}
