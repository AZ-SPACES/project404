package com.aza.backend.dto.qrlogin;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class QrLoginAuthorizeRequest {
    @NotBlank
    private String challengeToken;
}
