package com.aza.backend.dto.chat;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class EditMessageRequest {

    /** New encrypted ciphertext — must use the same E2EE session key as the original. */
    @NotBlank(message = "Ciphertext is required")
    private String ciphertext;
}
