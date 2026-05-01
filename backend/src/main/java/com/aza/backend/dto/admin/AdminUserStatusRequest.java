package com.aza.backend.dto.admin;

import lombok.Data;

@Data
public class AdminUserStatusRequest {
    private String status; // ACTIVE, SUSPENDED, DEACTIVATED
    private String reason;
}
