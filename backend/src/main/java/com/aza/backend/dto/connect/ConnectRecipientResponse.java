package com.aza.backend.dto.connect;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

/**
 * Result of resolving a seller identifier before paying them. Deliberately minimal —
 * it only confirms the account exists and can receive, plus a masked display name so
 * the platform can show a confirmation. It never leaks contact details or balances.
 */
@Data
@Builder
public class ConnectRecipientResponse {
    private boolean found;
    private boolean canReceive;
    private UUID userId;
    /** Masked for privacy, e.g. "Ama O." */
    private String displayName;
    private String reason;
}
