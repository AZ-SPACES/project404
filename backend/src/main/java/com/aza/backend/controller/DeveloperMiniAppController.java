package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.miniapp.MiniAppDetailResponse;
import com.aza.backend.dto.miniapp.SubmitMiniAppRequest;
import com.aza.backend.entity.User;
import com.aza.backend.service.MiniAppService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

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

    /**
     * Upload a static bundle for Aza to host, for developers with no domain or server of their
     * own. Send the zipped contents of a build output directory (Vite {@code dist/}, Expo
     * {@code npx expo export --platform web}) as multipart field {@code file}.
     *
     * <p>The upload is staged, not published: it becomes reachable at the app's preview host
     * for review, and only reaches users once an admin approves it. Uploading against a live
     * app is therefore safe.
     */
    @PostMapping(value = "/{appId}/bundle", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<MiniAppDetailResponse>> uploadBundle(
            @PathVariable String appId,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal User developer) {
        return ResponseEntity.ok(ApiResponse.success(
                miniAppService.uploadBundle(appId, file, developer)));
    }
}
