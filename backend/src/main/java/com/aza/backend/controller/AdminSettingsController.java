package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.admin.SystemSettingsResponse;
import com.aza.backend.service.SystemSettingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/settings")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminSettingsController {

    private final SystemSettingService settingService;

    @GetMapping
    public ResponseEntity<ApiResponse<SystemSettingsResponse>> getSettings() {
        return ResponseEntity.ok(ApiResponse.success(settingService.getSettings()));
    }

    @PatchMapping
    public ResponseEntity<ApiResponse<SystemSettingsResponse>> updateSettings(
            @RequestBody SystemSettingService.SystemSettingsRequest request) {
        return ResponseEntity.ok(ApiResponse.success(settingService.updateSettings(request)));
    }
}
