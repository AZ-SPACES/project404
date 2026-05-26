package com.aza.backend.dto.merchant;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class KybStatusResponse {

    private String status;
    private String registrationNumber;
    private String businessType;
    private String registeredAddress;
    private String city;
    private String taxIdNumber;
    private String website;
    private String ownerFullName;
    private String ownerIdType;
    private String rejectionReason;
    private String moreInfoRequest;
    private List<KybDocumentResponse> documents;
    private LocalDateTime submittedAt;
    private LocalDateTime reviewedAt;
}
