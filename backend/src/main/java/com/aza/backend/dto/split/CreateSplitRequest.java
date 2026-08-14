package com.aza.backend.dto.split;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class CreateSplitRequest {

    @NotNull(message = "Total amount is required")
    @DecimalMin(value = "1.00", message = "A split must be at least GHS 1.00")
    @DecimalMax(value = "999999.99", message = "Amount exceeds maximum allowed")
    private BigDecimal totalAmount;

    @NotBlank(message = "Say what the bill was for")
    @Size(max = 140, message = "Description cannot exceed 140 characters")
    private String description;

    /** EQUAL or EXACT. Defaults to EQUAL. */
    @Size(max = 16)
    private String splitMode;

    /**
     * Everyone splitting the bill, not counting the organiser — they are added
     * automatically and are never asked to pay themselves.
     */
    @NotEmpty(message = "Add at least one person to split with")
    @Size(max = 30, message = "A split may include at most 30 people")
    @Valid
    private List<Participant> participants;

    @NotBlank(message = "Idempotency key is required")
    private String idempotencyKey;

    @Data
    public static class Participant {
        /** Handle, phone, or email — resolved the way a transfer resolves a payee. */
        @NotBlank(message = "Each person needs an identifier")
        @Size(max = 120)
        private String identifier;

        /** Required for EXACT, ignored for EQUAL. */
        @DecimalMin(value = "0.01", message = "A share must be at least GHS 0.01")
        private BigDecimal amount;
    }
}
