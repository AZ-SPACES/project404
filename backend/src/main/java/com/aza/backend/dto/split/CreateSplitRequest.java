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

    /** EQUAL, EXACT, SHARES, or PERCENTAGE. Defaults to EQUAL. */
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

    /**
     * How many parts the organiser carries in a SHARES split, or what percentage of the
     * bill they take in a PERCENTAGE one. Defaults to one share, or to whatever the
     * named percentages leave over.
     */
    @Min(value = 0, message = "A share count cannot be negative")
    @Max(value = 100, message = "A share count may be at most 100")
    private Integer organiserShares;

    @NotBlank(message = "Idempotency key is required")
    private String idempotencyKey;

    @Data
    public static class Participant {
        /** Handle, phone, or email — resolved the way a transfer resolves a payee. */
        @NotBlank(message = "Each person needs an identifier")
        @Size(max = 120)
        private String identifier;

        /** Required for EXACT, ignored otherwise. */
        @DecimalMin(value = "0.01", message = "A share must be at least GHS 0.01")
        private BigDecimal amount;

        /** Required for SHARES: how many parts of the bill this person carries. */
        @Min(value = 1, message = "A share count must be at least 1")
        @Max(value = 100, message = "A share count may be at most 100")
        private Integer shares;

        /** Required for PERCENTAGE: this person's percentage of the bill. */
        @DecimalMin(value = "0.01", message = "A percentage must be above zero")
        @DecimalMax(value = "100.00", message = "A percentage cannot exceed 100")
        private BigDecimal percentage;
    }
}
