package com.aza.backend.dto.merchant;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class MerchantResponse {

    private String id;
    private String userId;
    private String businessName;
    private String businessHandle;
    private String businessEmail;
    private String businessPhone;
    private String businessDescription;
    private String logoUrl;
    private String category;
    private String status;
    private String rejectionReason;
    private String moreInfoRequest;
    private BigDecimal balance;
    private String currency;
    private BigDecimal totalVolume;
    private Integer feeRateBps;
    private LocalDateTime createdAt;
    private LocalDateTime activatedAt;
}
