package com.aza.backend.dto.admin;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class SystemSettingsResponse {
    private boolean maintenanceMode;
    private boolean registrationEnabled;
    private boolean kycRequired;
    private BigDecimal maxDailyTransferGhs;
    private BigDecimal maxSingleTransactionGhs;
    private String supportEmail;
    private String supportPhone;
    private String platformVersion;
    private FeatureFlags featureFlags;

    @Data
    @Builder
    public static class FeatureFlags {
        private boolean biometricEnabled;
        private boolean p2pEnabled;
        private boolean notificationsEnabled;
    }
}
