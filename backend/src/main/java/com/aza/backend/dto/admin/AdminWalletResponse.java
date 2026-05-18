package com.aza.backend.dto.admin;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class AdminWalletResponse {
    private String walletId;
    private String userId;
    private String userName;
    private String userHandle;
    private String userEmail;
    private BigDecimal balance;
    private String currency;
    private Boolean frozen;
    private LocalDateTime lastUpdatedAt;
}
