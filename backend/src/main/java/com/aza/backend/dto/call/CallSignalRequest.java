package com.aza.backend.dto.call;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

/**
 * Generic signal relay request.
 * Used for SDP offer/answer and ICE candidates.
 * The server relays these opaquely to the other participant.
 */
@Data
public class CallSignalRequest {

    @NotNull(message = "Call ID is required")
    private UUID callId;

    @NotBlank(message = "Signal data is required")
    private String data; // SDP or ICE candidate JSON string
}
