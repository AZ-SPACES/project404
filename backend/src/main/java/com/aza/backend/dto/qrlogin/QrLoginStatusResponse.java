package com.aza.backend.dto.qrlogin;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class QrLoginStatusResponse {
    private String status; // PENDING | APPROVED | EXPIRED
}
