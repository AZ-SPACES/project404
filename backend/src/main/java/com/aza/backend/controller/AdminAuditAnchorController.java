package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.entity.AuditAnchor;
import com.aza.backend.service.AuditAnchorService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/audit-anchors")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','COMPLIANCE')")
public class AdminAuditAnchorController {

    private final AuditAnchorService auditAnchorService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<AuditAnchor>>> recent() {
        return ResponseEntity.ok(ApiResponse.success(auditAnchorService.recentAnchors()));
    }

    @PostMapping("/verify")
    public ResponseEntity<ApiResponse<List<AuditAnchorService.VerificationResult>>> verify() {
        return ResponseEntity.ok(ApiResponse.success(auditAnchorService.verifyChain()));
    }
}
