package com.aza.backend.dto.merchant;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class WebhookEndpointRequest {

    @NotBlank
    @Pattern(regexp = "https://.*", message = "Webhook URL must use HTTPS")
    private String url;

    private String events; // comma-separated, default: "checkout.completed"

    private Boolean isActive;
}
