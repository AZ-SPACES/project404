package com.aza.backend.dto.transfer;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class TransferConfirmRequest {

    @NotBlank(message = "Passcode is required")
    @Size(min = 4, max = 4, message = "Passcode must be 4 digits")
    private String passcode;
}
