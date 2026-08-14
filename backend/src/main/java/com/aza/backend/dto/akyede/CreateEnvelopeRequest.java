package com.aza.backend.dto.akyede;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
public class CreateEnvelopeRequest {

    /**
     * Who the gift is for — a handle, phone number, or user id, resolved the same way a
     * transfer resolves a payee. A gift is addressed to a person, so this is required.
     */
    @NotBlank(message = "Choose who the gift is for")
    @Size(max = 120)
    private String recipient;

    @NotNull(message = "Amount is required")
    @DecimalMin(value = "1.00", message = "A gift must be at least GHS 1.00")
    @DecimalMax(value = "999999.99", message = "Amount exceeds maximum allowed")
    private BigDecimal amount;

    /** What the gift is for. Chooses the wrapping; defaults to JUST_BECAUSE. */
    @Size(max = 24)
    private String occasion;

    @Size(max = 140, message = "Message cannot exceed 140 characters")
    private String message;

    /** Set to drop the gift straight into an Aza thread. */
    private UUID chatId;

    /** How long before an unopened gift goes back to the sender. Defaults to 7 days. */
    @Min(value = 1, message = "A gift must stay open at least an hour")
    @Max(value = 720, message = "A gift may stay open at most 30 days")
    private Integer expiresInHours;

    /**
     * Sending a gift takes money out of the wallet, so it is authorised like every other
     * debit rather than on the strength of a live session alone.
     */
    @NotBlank(message = "Passcode is required")
    private String passcode;

    @NotBlank(message = "Idempotency key is required")
    private String idempotencyKey;
}
