package com.aza.backend.dto.merchant;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class CreateCheckoutSessionRequest {

    @NotNull
    @DecimalMin("0.01")
    private BigDecimal amount;

    private String description;
    private String metadata; // arbitrary JSON string

    // Your own reference for this payment (e.g. order or tenant/seller id). Returned on the
    // session and in the webhook payload, and filterable via GET /sessions?reference=...
    @Size(max = 255)
    private String reference;

    private String successUrl;
    private String cancelUrl;
    private String idempotencyKey;

    // Marketplace split settlement (Aza Connect). When set, each seller's fixed amount is
    // credited straight to their wallet at payment; the platform keeps the remainder after
    // the Aza fee. Sum of splits must not exceed the amount net of the Aza fee.
    @Valid
    @Size(max = 20, message = "A checkout session may have at most 20 splits")
    private List<CheckoutSplitRequest> splits;

    /**
     * "AUTOMATIC" (default) settles to you at payment. "MANUAL" holds the money until you
     * call POST /sessions/{id}/release — use it when money should reach someone only after
     * something happens. Aza never learns what that something is.
     */
    @Pattern(regexp = "(?i)AUTOMATIC|MANUAL", message = "release must be AUTOMATIC or MANUAL")
    private String release;

    /**
     * MANUAL only: how long Aza holds the money before returning it to the payer.
     * Defaults to 30 days. Absence of a release call is not evidence anything was earned,
     * so an expired hold refunds rather than releases.
     */
    @Min(value = 1, message = "maxHoldDays must be at least 1")
    @Max(value = 90, message = "maxHoldDays may not exceed 90")
    private Integer maxHoldDays;

    /**
     * MANUAL only: who gets paid on release. Each must already have an Aza account —
     * validated here, so an unpayable recipient fails session creation rather than
     * surfacing days later when the payer's money is already committed.
     */
    @Valid
    @Size(max = 20, message = "A hold may have at most 20 recipients")
    private List<HoldRecipientRequest> recipients;
}
