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

        double anyTwoFactorPct = totalUsers > 0 ? Math.round((anyTwoFactor * 1000.0 / totalUsers)) / 10.0 : 0.0;
        double smsPct         = totalUsers > 0 ? Math.round((sms        * 1000.0 / totalUsers)) / 10.0 : 0.0;
        double emailPct       = totalUsers > 0 ? Math.round((email      * 1000.0 / totalUsers)) / 10.0 : 0.0;
        double appPct         = totalUsers > 0 ? Math.round((app        * 1000.0 / totalUsers)) / 10.0 : 0.0;

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalUsers", totalUsers);
        result.put("anyTwoFactor", anyTwoFactor);
        result.put("sms", sms);
        result.put("email", email);
        result.put("app", app);
        result.put("passkeys", passkeys);
        result.put("biometrics", biometrics);
        result.put("anyTwoFactorPct", anyTwoFactorPct);
        result.put("smsPct", smsPct);
        result.put("emailPct", emailPct);
        result.put("appPct", appPct);
        return ResponseEntity.ok(ApiResponse.success(result));
    }
}
