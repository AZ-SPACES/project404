package com.aza.backend.dto.merchant;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ConfirmCheckoutRequest {

    @NotBlank
    private String passcode;
}
