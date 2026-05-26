package com.aza.backend.dto.merchant;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class WebhookEndpointRequest {

    @NotBlank
    private String url;

    private String events; // comma-separated, default: "checkout.completed"

    private Boolean isActive;
}
