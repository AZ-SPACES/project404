package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.service.AdminAnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/analytics")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminAnalyticsController {

    private final AdminAnalyticsService adminAnalyticsService;

    /** Task 4: Cohort / retention analytics */
    @GetMapping("/cohorts")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getCohorts(
            @RequestParam(defaultValue = "6") int months) {
        return ResponseEntity.ok(ApiResponse.success(adminAnalyticsService.getCohortRetention(months)));
    }

    /** Task 5: Revenue / volume dashboard */
    @GetMapping("/revenue")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getRevenue(
            @RequestParam(defaultValue = "12") int months) {
        return ResponseEntity.ok(ApiResponse.success(adminAnalyticsService.getRevenueDashboard(months)));
    }
}
