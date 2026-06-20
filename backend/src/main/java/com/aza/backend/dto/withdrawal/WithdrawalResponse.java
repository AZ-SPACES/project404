package com.aza.backend.dto.withdrawal;

import com.aza.backend.entity.UserWithdrawal;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * User-facing view of a withdrawal. Deliberately omits internal fields such as
 * the reviewing admin's id to avoid leaking back-office identity to the user.
 */
@Data
@Builder
public class WithdrawalResponse {
    private UUID id;
    private UUID userId;
    private BigDecimal amount;
    private String currency;
    private String provider;
    private String destination;
    private String bankName;
    private String status;
    private String note;
    private LocalDateTime createdAt;
    private LocalDateTime reviewedAt;

    public static WithdrawalResponse from(UserWithdrawal w) {
        return WithdrawalResponse.builder()
                .id(w.getId())
                .userId(w.getUserId())
                .amount(w.getAmount())
                .currency(w.getCurrency())
                .provider(w.getProvider())
                .destination(w.getDestination())
                .bankName(w.getBankName())
                .status(w.getStatus() != null ? w.getStatus().name() : null)
                .note(w.getAdminNote())
                .createdAt(w.getCreatedAt())
                .reviewedAt(w.getReviewedAt())
                .build();
    }
}
