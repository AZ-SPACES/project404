package com.aza.backend.dto.kyc;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
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
}
