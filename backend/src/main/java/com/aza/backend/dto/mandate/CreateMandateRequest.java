package com.aza.backend.dto.mandate;

import com.aza.backend.entity.PaymentMandate;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class CreateMandateRequest {

    /** The merchant to authorize — business handle, with or without a leading "@". */
    @NotBlank
    private String recipientIdentifier;

    @NotNull
    @DecimalMin("0.01")
    private BigDecimal perChargeLimit;

    /** Null = no period cap; only perChargeLimit applies per charge. */
    private BigDecimal periodLimit;

    private PaymentMandate.PeriodType periodType;

    /** Optional hard end date. Null = open-ended. */
    private LocalDateTime expiresAt;

    /** Merchant-supplied label shown to the user, e.g. "Netflix Premium". */
    private String reference;
}
