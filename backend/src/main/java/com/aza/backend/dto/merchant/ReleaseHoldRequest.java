package com.aza.backend.dto.merchant;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

/**
 * Authorize settlement of a hold. Omit {@code recipients} to release everything still
 * held; supply them to release part of it (remaining amounts stay held until a further
 * release or a refund).
 */
@Data
public class ReleaseHoldRequest {

    @Valid
    @Size(max = 20)
    private List<HoldRecipientRequest> recipients;

    /**
     * Free text stored on the audit event for the integrator's own records
     * ("milestone 2 approved"). Aza stores it and never interprets it.
     */
    @Size(max = 500)
    private String reason;
}
