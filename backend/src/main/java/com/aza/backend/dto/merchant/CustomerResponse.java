package com.aza.backend.dto.merchant;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CustomerResponse {
    private String id;
    private String name;
    private String email;
    private String phone;
    private long totalPayments;
    private BigDecimal totalSpend;
    private LocalDateTime firstPaymentAt;
    private LocalDateTime lastPaymentAt;
}
