package com.aza.backend.service;

import com.aza.backend.dto.admin.SystemSettingsResponse;
import com.aza.backend.entity.SystemSetting;
import com.aza.backend.repository.SystemSettingRepository;
import com.aza.backend.security.reputation.IpReputationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SystemSettingService {

    private final SystemSettingRepository repo;
    private final IpReputationService ipReputation;
    private final CloudflareService cloudflare;

    // Default values used when a setting key doesn't exist in DB yet
    private static final Map<String, String> DEFAULTS = Map.ofEntries(
            Map.entry("maintenance_mode", "false"),
            Map.entry("registration_enabled", "true"),
            Map.entry("kyc_required", "true"),
            Map.entry("max_daily_transfer_ghs", "10000.00"),
            Map.entry("max_single_transaction_ghs", "5000.00"),
            Map.entry("support_email", "support@aza.app"),
            Map.entry("support_phone", "+233 XX XXX XXXX"),
            Map.entry("platform_version", "1.0.0"),
            Map.entry("feature_biometric", "true"),
            Map.entry("feature_p2p", "true"),
            Map.entry("feature_notifications", "true"),
            Map.entry("blocked_countries", "KP,CU,IR,SY,RU,BY,MM")
    );

    private String get(String key) {
        return repo.findById(key)
                .map(SystemSetting::getValue)
                .orElse(DEFAULTS.getOrDefault(key, ""));
    }

    private boolean getBool(String key) {
        return "true".equalsIgnoreCase(get(key));
    }

    private BigDecimal getDecimal(String key) {
        try { return new BigDecimal(get(key)); } catch (Exception e) { return BigDecimal.ZERO; }
    }

    private List<String> getList(String key) {
        String raw = get(key);
        if (raw == null || raw.isBlank()) return List.of();
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .collect(Collectors.toList());
    }

    public SystemSettingsResponse getSettings() {
        return SystemSettingsResponse.builder()
                .maintenanceMode(getBool("maintenance_mode"))
                .registrationEnabled(getBool("registration_enabled"))
                .kycRequired(getBool("kyc_required"))
                .maxDailyTransferGhs(getDecimal("max_daily_transfer_ghs"))
                .maxSingleTransactionGhs(getDecimal("max_single_transaction_ghs"))
                .supportEmail(get("support_email"))
                .supportPhone(get("support_phone"))
                .platformVersion(get("platform_version"))
                .blockedCountries(getList("blocked_countries"))
                .featureFlags(SystemSettingsResponse.FeatureFlags.builder()
                        .biometricEnabled(getBool("feature_biometric"))
                        .p2pEnabled(getBool("feature_p2p"))
                        .notificationsEnabled(getBool("feature_notifications"))
                        .build())
                .build();
    }

    @Transactional
    public SystemSettingsResponse updateSettings(SystemSettingsRequest req) {
        if (req.getMaintenanceMode() != null) save("maintenance_mode", req.getMaintenanceMode().toString());
        if (req.getRegistrationEnabled() != null) save("registration_enabled", req.getRegistrationEnabled().toString());
        if (req.getKycRequired() != null) save("kyc_required", req.getKycRequired().toString());
        if (req.getMaxDailyTransferGhs() != null) save("max_daily_transfer_ghs", req.getMaxDailyTransferGhs().toPlainString());
        if (req.getMaxSingleTransactionGhs() != null) save("max_single_transaction_ghs", req.getMaxSingleTransactionGhs().toPlainString());
        if (req.getSupportEmail() != null) save("support_email", req.getSupportEmail());
        if (req.getSupportPhone() != null) save("support_phone", req.getSupportPhone());
        if (req.getBlockedCountries() != null) {
            List<String> codes = req.getBlockedCountries().stream()
                    .map(String::trim)
                    .map(String::toUpperCase)
                    .filter(s -> !s.isBlank())
                    .collect(Collectors.toList());
            save("blocked_countries", String.join(",", codes));
            ipReputation.invalidateGeoBlockCache();
            cloudflare.syncGeoBlockRule(codes);
        }
        if (req.getFeatureFlags() != null) {
            SystemSettingsRequest.FeatureFlagsReq f = req.getFeatureFlags();
            if (f.getBiometricEnabled() != null) save("feature_biometric", f.getBiometricEnabled().toString());
            if (f.getP2pEnabled() != null) save("feature_p2p", f.getP2pEnabled().toString());
            if (f.getNotificationsEnabled() != null) save("feature_notifications", f.getNotificationsEnabled().toString());
        }
        return getSettings();
    }

    private void save(String key, String value) {
        repo.save(new SystemSetting(key, value, null));
    }

    // Inline request class to avoid creating a separate file
    @lombok.Data
    public static class SystemSettingsRequest {
        private Boolean maintenanceMode;
        private Boolean registrationEnabled;
        private Boolean kycRequired;
        private BigDecimal maxDailyTransferGhs;
        private BigDecimal maxSingleTransactionGhs;
        private String supportEmail;
        private String supportPhone;
        private List<String> blockedCountries;
        private FeatureFlagsReq featureFlags;

        @lombok.Data
        public static class FeatureFlagsReq {
            private Boolean biometricEnabled;
            private Boolean p2pEnabled;
            private Boolean notificationsEnabled;
        }
    }
}
