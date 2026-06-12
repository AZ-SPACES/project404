package com.aza.backend.service;

import com.aza.backend.entity.SystemSetting;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.SystemSettingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * COMPLIANCE-tunable thresholds for the transaction risk engine, stored in
 * system_settings so changing a rule doesn't need a deploy.
 */
@Service
@RequiredArgsConstructor
public class RiskRuleService {

    private final SystemSettingRepository settingRepository;
    private final AdminAuditService auditService;

    private static final String KEY_LARGE_TRANSFER = "risk_large_transfer_ghs";
    private static final String KEY_VELOCITY_MAX = "risk_velocity_max_hourly";

    private static final String DEFAULT_LARGE_TRANSFER = "5000.00";
    private static final String DEFAULT_VELOCITY_MAX = "10";

    public BigDecimal largeTransferThresholdGhs() {
        return new BigDecimal(get(KEY_LARGE_TRANSFER, DEFAULT_LARGE_TRANSFER));
    }

    public int velocityMaxHourly() {
        return Integer.parseInt(get(KEY_VELOCITY_MAX, DEFAULT_VELOCITY_MAX));
    }

    public Map<String, String> getRules() {
        Map<String, String> rules = new LinkedHashMap<>();
        rules.put("largeTransferGhs", get(KEY_LARGE_TRANSFER, DEFAULT_LARGE_TRANSFER));
        rules.put("velocityMaxHourly", get(KEY_VELOCITY_MAX, DEFAULT_VELOCITY_MAX));
        return rules;
    }

    @Transactional
    public Map<String, String> updateRules(User admin, String largeTransferGhs, String velocityMaxHourly) {
        if (largeTransferGhs != null) {
            try {
                if (new BigDecimal(largeTransferGhs).signum() <= 0) throw new NumberFormatException();
            } catch (NumberFormatException e) {
                throw new AppException("INVALID_RULE", "largeTransferGhs must be a positive amount", HttpStatus.BAD_REQUEST);
            }
            put(KEY_LARGE_TRANSFER, largeTransferGhs);
        }
        if (velocityMaxHourly != null) {
            try {
                if (Integer.parseInt(velocityMaxHourly) <= 0) throw new NumberFormatException();
            } catch (NumberFormatException e) {
                throw new AppException("INVALID_RULE", "velocityMaxHourly must be a positive integer", HttpStatus.BAD_REQUEST);
            }
            put(KEY_VELOCITY_MAX, velocityMaxHourly);
        }
        auditService.log(admin, "UPDATE_RISK_RULES", null,
                "largeTransferGhs=" + largeTransferGhs + " velocityMaxHourly=" + velocityMaxHourly);
        return getRules();
    }

    private String get(String key, String fallback) {
        return settingRepository.findById(key).map(SystemSetting::getValue).orElse(fallback);
    }

    private void put(String key, String value) {
        settingRepository.save(SystemSetting.builder().key(key).value(value).build());
    }
}
