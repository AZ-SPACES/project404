package com.aza.backend.dto.qrlogin;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class QrLoginInitiateRequest {
    @NotNull
    private QrSiteType siteType;
}
