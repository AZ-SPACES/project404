package com.aza.backend.dto.call;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class CallIdRequest {
    @NotNull(message = "Call ID is required")
    private UUID callId;
}
