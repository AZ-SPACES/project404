package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/analytics/2fa")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','COMPLIANCE')")
public class AdminTwoFactorController {

    private final UserRepository userRepository;

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<Map<String, Object>>> stats() {
        long totalUsers = userRepository.count();
        long anyTwoFactor = userRepository.countByTwoFactorEnabledTrue();
        long sms = userRepository.countBySmsTwoFactorEnabledTrue();
        long email = userRepository.countByEmailTwoFactorEnabledTrue();
        long app = userRepository.countByAppTwoFactorEnabledTrue();
        long passkeys = userRepository.countByPasskeysEnabledTrue();
        long biometrics = userRepository.countByBiometricsEnabledTrue();

        double pctEnrolled = totalUsers > 0
                ? Math.round((anyTwoFactor * 1000.0 / totalUsers)) / 10.0
                : 0.0;

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalUsers", totalUsers);
        result.put("anyTwoFactorEnabled", anyTwoFactor);
        result.put("pctEnrolled", pctEnrolled);
        result.put("byMethod", Map.of(
                "sms", sms,
                "email", email,
                "app", app,
                "passkeys", passkeys,
                "biometrics", biometrics
        ));
        return ResponseEntity.ok(ApiResponse.success(result));
    }
}
