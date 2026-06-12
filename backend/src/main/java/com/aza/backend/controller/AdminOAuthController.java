package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.service.OAuthService;
import com.aza.backend.service.OAuthService.AdminClientSummary;
import com.aza.backend.service.OAuthService.AdminOAuthStats;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/oauth")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminOAuthController {

    private final OAuthService oAuthService;

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<AdminOAuthStats>> stats() {
        return ResponseEntity.ok(ApiResponse.success(oAuthService.adminGetStats()));
    }

    @GetMapping("/clients")
    public ResponseEntity<ApiResponse<Page<AdminClientSummary>>> list(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) Boolean active,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(oAuthService.adminListClients(query, active, page, size)));
    }

    @GetMapping("/clients/{clientId}")
    public ResponseEntity<ApiResponse<AdminClientSummary>> get(@PathVariable String clientId) {
        return ResponseEntity.ok(ApiResponse.success(oAuthService.adminGetClient(clientId)));
    }

    @PostMapping("/clients/{clientId}/suspend")
    public ResponseEntity<ApiResponse<AdminClientSummary>> suspend(@PathVariable String clientId) {
        return ResponseEntity.ok(ApiResponse.success(oAuthService.adminSuspendClient(clientId)));
    }

    @PostMapping("/clients/{clientId}/restore")
    public ResponseEntity<ApiResponse<AdminClientSummary>> restore(@PathVariable String clientId) {
        return ResponseEntity.ok(ApiResponse.success(oAuthService.adminRestoreClient(clientId)));
    }

    @DeleteMapping("/clients/{clientId}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable String clientId) {
        oAuthService.adminDeleteClient(clientId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
