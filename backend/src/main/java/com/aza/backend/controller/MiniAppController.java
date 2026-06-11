package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.MiniAppReportRequest;
import com.aza.backend.entity.User;
import com.aza.backend.service.MiniAppReportService;
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
}
