package com.aza.backend.dto.superagent;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.math.BigDecimal;

/**
 * Moves float between the calling master agent and one of its sub-agents. The sub-agent is
 * named by till code or by agent id; exactly one is required.
 */
@Data
public class DistributeFloatRequest {
    private String subAgentCode;
    private String subAgentId;

    @NotNull(message = "Amount is required")
    @Positive(message = "Amount must be greater than zero")
    private BigDecimal amount;

    private String note;

    /**
     * Required, not optional. Without a key a double-submit moves float twice, and the portal
     * is not the only thing that can call this endpoint — a client that forgets to send one
     * should be refused rather than quietly given at-least-once semantics.
     */
    @NotBlank(message = "An idempotency key is required")
    private String idempotencyKey;

    /**
     * The operator's 4-digit passcode. Every other user-initiated wallet debit in the platform
     * verifies it (transfer, withdrawal, bill pay, red envelope), and a float distribution is a
     * larger movement than most of them — a hijacked portal session should not be able to drain
     * a master's float on its own.
     */
    @NotBlank(message = "Your passcode is required")
    @Pattern(regexp = "\\d{4}", message = "Passcode must be 4 digits")
    private String passcode;
}
