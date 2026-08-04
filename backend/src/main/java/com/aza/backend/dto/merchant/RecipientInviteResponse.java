package com.aza.backend.dto.merchant;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

/** An invitation for someone to join Aza so this merchant can pay them. */
@Data
@Builder
public class RecipientInviteResponse {

    private String id;
    /** The normalized identifier — compare against this, not what you sent. */
    private String recipient;
    private String displayName;
    private String reference;
    /** PENDING until they have an Aza account, then FULFILLED. */
    private String status;
    /** Whether Aza texted them. False is not a failure — share signupUrl yourself. */
    private boolean smsSent;
    /**
     * Set when the person already has an Aza account that cannot receive money (inactive,
     * or a frozen wallet). They will stay PENDING and no signup webhook will ever fire for
     * them, so act on this rather than waiting.
     */
    private String unpayableReason;
    private String signupUrl;
    private LocalDateTime createdAt;
    private LocalDateTime fulfilledAt;
}
