package com.aza.backend.dto.merchant;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class WebhookEndpointResponse {

    private String id;
    private String url;
    private String signingSecret; // only set on creation
    private Boolean isActive;
    private String events;
    private LocalDateTime createdAt;
}
