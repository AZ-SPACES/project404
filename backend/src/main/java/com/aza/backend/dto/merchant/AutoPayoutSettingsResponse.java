package com.aza.backend.dto.merchant;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AutoPayoutSettingsResponse {

    private Boolean autoPayoutEnabled;
    private String autoPayoutSchedule;
    private BigDecimal autoPayoutMinBalance;
    private Integer autoPayoutDay;
}
