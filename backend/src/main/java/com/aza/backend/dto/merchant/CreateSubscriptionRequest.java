package com.aza.backend.dto.merchant;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class CreateSubscriptionRequest {
    @NotNull
    private UUID planId;
    @NotBlank
    private String customerName;
    private String customerEmail;
    private String customerId;
}
