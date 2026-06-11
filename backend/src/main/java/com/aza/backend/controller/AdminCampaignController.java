package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.admin.CampaignRequest;
import com.aza.backend.service.AdminCampaignService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/campaigns")
@RequiredArgsConstructor
public class AdminCampaignController {

    private final AdminCampaignService adminCampaignService;

    @PostMapping("/send")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, String>>> sendCampaign(@RequestBody CampaignRequest request) {
        if (request.getType() == null || request.getSegment() == null || request.getMessage() == null) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("VALIDATION_ERROR", "Missing required fields (type, segment, message)"));
        }

        // Start async processing
        adminCampaignService.processCampaign(request);

        return ResponseEntity.ok(ApiResponse.success(
                Map.of("message", "Campaign queued for sending to segment: " + request.getSegment())));
    }
}
