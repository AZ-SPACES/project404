package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.miniapp.MiniAppDetailResponse;
import com.aza.backend.dto.miniapp.SubmitMiniAppRequest;
import com.aza.backend.entity.User;
import com.aza.backend.service.MiniAppService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Developer-facing endpoints: create/edit apps, check review status,
 * resubmit after rejection. Requires a normal user JWT (the developer IS an Aza user).
 */
@RestController
@RequestMapping("/api/v1/dev/miniapps")
@RequiredArgsConstructor
public class DeveloperMiniAppController {

    private final MiniAppService miniAppService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<MiniAppDetailResponse>>> getMyApps(
            @AuthenticationPrincipal User developer) {
        return ResponseEntity.ok(ApiResponse.success(miniAppService.getMyApps(developer)));
    }

    @GetMapping("/{appId}")
    public ResponseEntity<ApiResponse<MiniAppDetailResponse>> getApp(
            @PathVariable String appId,
            @AuthenticationPrincipal User developer) {
        return ResponseEntity.ok(ApiResponse.success(miniAppService.getMyApp(appId, developer)));
    }

    /**
     * Create or update an app. If {@code submitForReview=true} in the body the status
     * transitions to PENDING_REVIEW immediately.
     */
    @PutMapping
    public ResponseEntity<ApiResponse<MiniAppDetailResponse>> saveApp(
            @Valid @RequestBody SubmitMiniAppRequest request,
            @AuthenticationPrincipal User developer) {
        return ResponseEntity.ok(ApiResponse.success(miniAppService.saveApp(request, developer)));
    }

    /** Resubmit a REJECTED or DRAFT app for admin review without changing any fields. */
    @PostMapping("/{appId}/resubmit")
    public ResponseEntity<ApiResponse<MiniAppDetailResponse>> resubmit(
            @PathVariable String appId,
            @AuthenticationPrincipal User developer) {
        return ResponseEntity.ok(ApiResponse.success(miniAppService.resubmit(appId, developer)));
    }
}
