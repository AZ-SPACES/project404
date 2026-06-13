package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.merchant.KybDocumentResponse;
import com.aza.backend.entity.User;
import com.aza.backend.service.MobileKybService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequiredArgsConstructor
public class MobileKybController {

    private final MobileKybService mobileKybService;

    /** Authenticated — merchant requests a handoff token for their phone. */
    @PostMapping("/api/v1/merchant/kyb/mobile-handoff")
    public ResponseEntity<ApiResponse<Map<String, String>>> generateHandoff(
            @AuthenticationPrincipal User user) {
        String token = mobileKybService.generateToken(user.getId());
        return ResponseEntity.ok(ApiResponse.success(Map.of("token", token)));
    }

    /** Public — mobile page calls this to know the merchant name and what docs are needed. */
    @GetMapping("/api/v1/public/kyb-mobile/{token}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getContext(@PathVariable String token) {
        String businessName = mobileKybService.getBusinessName(token);
        List<String> pending = mobileKybService.pendingDocTypes(token);
        Set<String> uploaded = mobileKybService.uploadedDocTypes(token);
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "businessName", businessName,
                "pendingDocTypes", pending,
                "uploadedDocTypes", uploaded
        )));
    }

    /** Public — mobile page uploads a document. */
    @PostMapping("/api/v1/public/kyb-mobile/{token}/upload")
    public ResponseEntity<ApiResponse<KybDocumentResponse>> uploadDocument(
            @PathVariable String token,
            @RequestParam("file") MultipartFile file,
            @RequestParam("type") String docType) {
        KybDocumentResponse doc = mobileKybService.uploadDocument(token, file, docType);
        return ResponseEntity.ok(ApiResponse.success(doc));
    }

    /** Public — desktop polls this to know when the phone is done. */
    @GetMapping("/api/v1/public/kyb-mobile/{token}/status")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getStatus(@PathVariable String token) {
        List<String> pending = mobileKybService.pendingDocTypes(token);
        Set<String> uploaded = mobileKybService.uploadedDocTypes(token);
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "pendingDocTypes", pending,
                "uploadedDocTypes", uploaded,
                "complete", pending.isEmpty()
        )));
    }
}
