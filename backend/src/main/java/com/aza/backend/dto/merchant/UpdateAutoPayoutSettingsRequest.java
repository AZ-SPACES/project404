package com.aza.backend.dto.merchant;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class UpdateAutoPayoutSettingsRequest {

    private Boolean autoPayoutEnabled;
    private String autoPayoutSchedule;
    private BigDecimal autoPayoutMinBalance;
    private Integer autoPayoutDay;
}
