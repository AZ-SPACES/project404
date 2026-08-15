package com.aza.backend.dto.bill;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class BillerResponse {
    private String slug;
    private String name;
    private String category;
    private String logoUrl;
    /** What to call the field the payer types into — "Meter number", "Phone number". */
    private String accountLabel;
    private BigDecimal minAmount;
    private BigDecimal maxAmount;
    private Boolean supportsNameLookup;
}
