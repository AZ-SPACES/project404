package com.aza.backend.dto.bill;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class PayBillRequest {

    @NotBlank(message = "Choose a biller")
    @Size(max = 60)
    private String billerSlug;

    @NotBlank(message = "Account number is required")
    @Size(max = 120)
    private String accountNumber;

    /** The name the lookup returned, kept on the record so a receipt can show it. */
    @Size(max = 160)
    private String accountName;

    @NotNull(message = "Amount is required")
    @DecimalMin(value = "1.00", message = "A bill payment must be at least GHS 1.00")
    @DecimalMax(value = "999999.99", message = "Amount exceeds maximum allowed")
    private BigDecimal amount;

    /** Paying a bill takes money out of the wallet, so it is authorised like any debit. */
    @NotBlank(message = "Passcode is required")
    private String passcode;

    @NotBlank(message = "Idempotency key is required")
    private String idempotencyKey;
}
