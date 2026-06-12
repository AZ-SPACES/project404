package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.entity.User;
import com.aza.backend.service.AdminStepUpService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** Acquire admin-console elevation. Exempt from AdminStepUpFilter; still requires a staff role. */
@RestController
@RequestMapping("/api/v1/admin/step-up")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','SUPPORT','COMPLIANCE','FINANCE')")
public class AdminStepUpController {

    private final AdminStepUpService stepUpService;

    @GetMapping("/status")
    public ResponseEntity<ApiResponse<Map<String, Object>>> status(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "elevated", stepUpService.isElevated(user.getId()),
                "method", stepUpService.requiredMethod(user))));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> verify(
            @RequestBody StepUpRequest request,
            @AuthenticationPrincipal User user) {
        stepUpService.verify(user, request.getCode(), request.getPassword());
        return ResponseEntity.ok(ApiResponse.success(Map.of("elevated", true)));
    }

    @Data
    static class StepUpRequest {
        private String code;
        private String password;
    }
}
