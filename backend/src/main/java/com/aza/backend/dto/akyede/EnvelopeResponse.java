package com.aza.backend.dto.akyede;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class EnvelopeResponse {

    private String id;
    private String claimCode;
    /** Deep link that opens the gift in the app — sent to the recipient, not broadcast. */
    private String claimUrl;

    private String senderName;
    private String senderHandle;
    private String senderAvatarUrl;

    private String recipientName;
    private String recipientHandle;
    private String recipientAvatarUrl;

    private String message;
    private String occasion;
    private String currency;
    private String status;

    private LocalDateTime expiresAt;
    private LocalDateTime createdAt;
    private LocalDateTime openedAt;

    /**
     * What the gift holds.
     *
     * The sender always sees it. The recipient does not until they open it — the amount
     * is theirs either way, but a gift that shows its value through the wrapping is not
     * much of a gift. Anyone else sees null, because a gift is nobody else's business.
     */
    private BigDecimal amount;

    /** True when the viewer is the recipient and may open it right now. */
    private Boolean openable;

    /**
     * Why not, when {@code openable} is false: NOT_YOURS, ALREADY_OPENED, EXPIRED,
     * OWN_GIFT.
     */
    private String blockedReason;

    /** True when the viewer sent this gift — the client shows the sender's side. */
    private Boolean sentByMe;
}
