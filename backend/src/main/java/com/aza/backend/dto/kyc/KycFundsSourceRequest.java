package com.aza.backend.dto.kyc;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class KycFundsSourceRequest {

    @NotBlank(message = "Funds source is required")
    private String fundsSource;  // comma-separated: "salary,savings,business"

    private String otherFundsText;
}
