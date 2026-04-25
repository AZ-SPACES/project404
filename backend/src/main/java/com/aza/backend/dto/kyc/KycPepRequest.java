package com.aza.backend.dto.kyc;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class KycPepRequest {

    @NotNull(message = "PEP answer is required")
    private Boolean isPep;

    private String pepStatus;   // "SELF" or "FAMILY_ASSOCIATE"
    private String pepRole;
}
