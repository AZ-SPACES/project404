package com.aza.backend.dto.kyc;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class KycStatusResponse {
    private String status;
    private int completionPercentage;
    private boolean consentGiven;
    private boolean fundsSourceSubmitted;
    private boolean idDocumentSubmitted;
    private boolean selfieSubmitted;
    private boolean pepScreeningDone;
    private boolean submitted;
    private String rejectionReason;
    private String verificationProvider;

    // Detail fields for Admin review
    private String idFrontUrl;
    private String idBackUrl;
    private String selfieUrl;
    private String idType;
    private String idNumber;
    private String fundsSource;
    private Boolean isPep;

    // User info for Admin review
    private String userId;
    private String displayName;
    private String email;
}
