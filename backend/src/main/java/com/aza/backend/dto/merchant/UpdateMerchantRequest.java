package com.aza.backend.dto.merchant;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateMerchantRequest {

    @Size(min = 2, max = 100)
    private String businessName;

    private String businessEmail;
    private String businessPhone;

    @Size(max = 500)
    private String businessDescription;

    private String logoUrl;

    // Branding
    private String brandColor;

    @Size(max = 200)
    private String checkoutTagline;

    private String supportEmail;

    // Tax
    private Boolean taxEnabled;
    private java.math.BigDecimal taxRate;
    private String taxLabel;
}
