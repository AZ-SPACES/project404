package com.aza.backend.dto.kyc;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class KycPepDetailsRequest {

    @NotBlank(message = "Account purpose is required")
    private String accountPurpose;  // day_to_day, savings, business, salary

    @NotBlank(message = "Monthly volume is required")
    private String monthlyVolume;   // below_10k, 10k_50k, 50k_100k, above_100k

    @NotBlank(message = "Wealth source is required")
    private String wealthSource;
}
