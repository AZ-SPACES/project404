package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.ReportHandleRequest;
import com.aza.backend.entity.User;
import com.aza.backend.service.HandleReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/** User-facing reporting of payment handles / store codes (e.g. scam, impersonation). */
@RestController
@RequestMapping("/api/v1/reports")
@RequiredArgsConstructor
public class ReportController {

    private final HandleReportService handleReportService;

    @PostMapping("/handle")
    public ResponseEntity<ApiResponse<Void>> reportHandle(
            @AuthenticationPrincipal User user,
            @RequestBody ReportHandleRequest request) {
        handleReportService.createReport(request, user);
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
