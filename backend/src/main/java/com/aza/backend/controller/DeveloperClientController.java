package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.oauth.OAuthClientRegistrationRequest;
import com.aza.backend.dto.oauth.OAuthClientResponse;
import com.aza.backend.entity.User;
import com.aza.backend.service.OAuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/developer/clients")
@RequiredArgsConstructor
public class DeveloperClientController {

    private final OAuthService oAuthService;

    @PostMapping
    public ResponseEntity<ApiResponse<OAuthClientResponse>> register(
            @Valid @RequestBody OAuthClientRegistrationRequest request,
            @AuthenticationPrincipal User user) {
        OAuthClientResponse response = oAuthService.registerClient(user, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<OAuthClientResponse>>> list(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(oAuthService.listClients(user)));
    }

    @GetMapping("/{clientId}")
    public ResponseEntity<ApiResponse<OAuthClientResponse>> get(
            @PathVariable String clientId,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(oAuthService.getClient(user, clientId)));
    }

    @PostMapping("/{clientId}/rotate-secret")
    public ResponseEntity<ApiResponse<OAuthClientResponse>> rotateSecret(
            @PathVariable String clientId,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(oAuthService.rotateSecret(user, clientId)));
    }

    @DeleteMapping("/{clientId}")
    public ResponseEntity<ApiResponse<Void>> delete(
            @PathVariable String clientId,
            @AuthenticationPrincipal User user) {
        oAuthService.deleteClient(user, clientId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/{clientId}/merchant")
    public ResponseEntity<ApiResponse<OAuthClientResponse>> linkMerchant(
            @PathVariable String clientId,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(oAuthService.linkMerchant(user, clientId)));
    }

    @DeleteMapping("/{clientId}/merchant")
    public ResponseEntity<ApiResponse<OAuthClientResponse>> unlinkMerchant(
            @PathVariable String clientId,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(oAuthService.unlinkMerchant(user, clientId)));
    }
}
