package com.aza.backend.dto.kyc;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class KycIdentityRequest {

    @NotBlank(message = "ID type is required")
    private String idType;  // GHANA_CARD, PASSPORT, VOTER_ID, DRIVERS_LICENCE

    @NotBlank(message = "ID number is required")
    private String idNumber;
}
