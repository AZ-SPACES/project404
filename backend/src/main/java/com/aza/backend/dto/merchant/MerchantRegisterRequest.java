package com.aza.backend.dto.merchant;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class MerchantRegisterRequest {

    @NotBlank
    @Size(min = 2, max = 100)
    private String businessName;

    @NotBlank
    @Size(min = 3, max = 30)
    private String businessHandle; // must be unique, alphanumeric + underscores

    private String businessEmail;
    private String businessPhone;
    private String businessDescription;
    private String category; // BusinessCategory enum name
}
