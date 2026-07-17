package com.aza.backend.dto.merchant;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
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
}
