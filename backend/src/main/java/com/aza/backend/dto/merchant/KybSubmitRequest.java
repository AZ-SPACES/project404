package com.aza.backend.dto.merchant;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class KybSubmitRequest {

    private String registrationNumber;

    @NotBlank
    private String businessType; // KybRecord.BusinessType enum name

    private String registeredAddress;
    private String city;
    private String taxIdNumber;
    private String website;

    @NotBlank
    private String ownerFullName;

    private String ownerIdNumber;
    private String ownerIdType; // KybRecord.OwnerIdType enum name
}
