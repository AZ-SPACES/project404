package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.MiniAppReportRequest;
import com.aza.backend.dto.miniapp.MiniAppRegistryEntry;
import com.aza.backend.entity.User;
import com.aza.backend.service.MiniAppReportService;
import com.aza.backend.service.MiniAppService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/miniapps")
@RequiredArgsConstructor
public class MiniAppController {

    private final MiniAppReportService reportService;
    private final MiniAppService miniAppService;

    /** Live catalog of all ACTIVE community mini apps. */
    @GetMapping
    public ResponseEntity<ApiResponse<List<MiniAppRegistryEntry>>> getRegistry() {
        return ResponseEntity.ok(ApiResponse.success(miniAppService.getActiveApps()));
    }

    @PostMapping("/{appId}/report")
    public ResponseEntity<ApiResponse<Void>> report(
            @PathVariable String appId,
            @AuthenticationPrincipal User user,
            @RequestBody MiniAppReportRequest request) {
        reportService.createReport(appId, request, user);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @GetMapping("/disabled")
    public ResponseEntity<ApiResponse<List<String>>> getDisabledApps() {
        return ResponseEntity.ok(ApiResponse.success(reportService.getDisabledAppIds()));
    }

    /** Apps that are disabled or under maintenance; active apps are omitted. */
    @GetMapping("/statuses")
    public ResponseEntity<ApiResponse<List<com.aza.backend.dto.MiniAppStatusResponse>>> getStatuses() {
        return ResponseEntity.ok(ApiResponse.success(reportService.getAppStatuses()));
    }
}
