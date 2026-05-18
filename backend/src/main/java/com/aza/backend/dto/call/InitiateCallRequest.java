package com.aza.backend.dto.call;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class InitiateCallRequest {

    @NotNull(message = "Callee ID is required")
    private UUID calleeId;

    @NotBlank(message = "Call type is required")
    private String type; // VOICE or VIDEO
}
