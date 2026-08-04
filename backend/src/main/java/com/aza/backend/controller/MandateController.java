package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.mandate.MandateConfirmRequest;
import com.aza.backend.dto.mandate.MandateResponse;
import com.aza.backend.entity.User;
import com.aza.backend.service.PaymentMandateService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * User-facing payment-mandate management. Creation itself happens on two different surfaces
 * (MiniAppSdkController for mini-apps, OAuthMandateController for Sign-in-with-AZA apps) since
 * each has its own consent/authentication story — but once a mandate exists, viewing, approving,
 * and cancelling it is the same regardless of where it came from.
 */
@RestController
@RequestMapping("/api/v1/mandates")
@RequiredArgsConstructor
public class MandateController {

    private final PaymentMandateService mandateService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<MandateResponse>>> list(@AuthenticationPrincipal User user) {
        List<MandateResponse> mandates = mandateService.list(user.getId()).stream()
                .map(mandateService::toResponse)
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success(mandates));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<MandateResponse>> get(
            @AuthenticationPrincipal User user, @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(mandateService.toResponse(mandateService.get(user.getId(), id))));
    }

    /** Public — merchant name/ceilings/cadence for the aza-pay hosted approval page, before login. */
    @GetMapping("/{id}/public")
    public ResponseEntity<ApiResponse<MandateResponse>> getPublic(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(mandateService.toResponse(mandateService.getPublic(id))));
    }

    @PostMapping("/{id}/confirm")
    public ResponseEntity<ApiResponse<MandateResponse>> confirm(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id,
            @Valid @RequestBody MandateConfirmRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                mandateService.toResponse(mandateService.confirm(user.getId(), id, request.getPasscode()))));
    }

    @PostMapping("/{id}/pause")
    public ResponseEntity<ApiResponse<MandateResponse>> pause(
            @AuthenticationPrincipal User user, @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(mandateService.toResponse(mandateService.pause(user.getId(), id))));
    }

    @PostMapping("/{id}/resume")
    public ResponseEntity<ApiResponse<MandateResponse>> resume(
            @AuthenticationPrincipal User user, @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(mandateService.toResponse(mandateService.resume(user.getId(), id))));
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<ApiResponse<MandateResponse>> cancel(
            @AuthenticationPrincipal User user, @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(mandateService.toResponse(mandateService.cancel(user.getId(), id))));
    }
}
