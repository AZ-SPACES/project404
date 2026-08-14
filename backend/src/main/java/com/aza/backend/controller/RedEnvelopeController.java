package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.akyede.CreateEnvelopeRequest;
import com.aza.backend.dto.akyede.EnvelopeResponse;
import com.aza.backend.entity.User;
import com.aza.backend.service.RedEnvelopeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/akyede")
@RequiredArgsConstructor
@Tag(name = "Akyede", description = "Giving one person money as a gift")
public class RedEnvelopeController {

    private final RedEnvelopeService redEnvelopeService;

    @Operation(summary = "Send a gift",
            description = "Debits the full amount from your wallet and holds it for the "
                    + "recipient. They are notified, and the money reaches them when they "
                    + "open it. A gift nobody opens comes back to you when it expires.")
    @PostMapping
    public ResponseEntity<ApiResponse<EnvelopeResponse>> create(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody CreateEnvelopeRequest request) {
        return ResponseEntity.ok(ApiResponse.success(redEnvelopeService.create(user, request)));
    }

    @Operation(summary = "Look at a gift",
            description = "Reads a gift without opening it. The amount stays hidden from "
                    + "the recipient until they open it, and from everyone else always.")
    @GetMapping("/{claimCode}")
    public ResponseEntity<ApiResponse<EnvelopeResponse>> preview(
            @AuthenticationPrincipal User user,
            @PathVariable String claimCode) {
        return ResponseEntity.ok(ApiResponse.success(
                redEnvelopeService.preview(claimCode, user != null ? user.getId() : null)));
    }

    @Operation(summary = "Open a gift sent to you",
            description = "Credits the amount to your wallet. Only the person the gift was "
                    + "addressed to may open it.")
    @PostMapping("/{claimCode}/open")
    public ResponseEntity<ApiResponse<EnvelopeResponse>> open(
            @AuthenticationPrincipal User user,
            @PathVariable String claimCode) {
        return ResponseEntity.ok(ApiResponse.success(redEnvelopeService.open(user, claimCode)));
    }

    @Operation(summary = "Gifts you have sent")
    @GetMapping
    public ResponseEntity<ApiResponse<Page<EnvelopeResponse>>> listSent(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                redEnvelopeService.listSent(user.getId(), page, size)));
    }

    @Operation(summary = "Gifts sent to you")
    @GetMapping("/received")
    public ResponseEntity<ApiResponse<Page<EnvelopeResponse>>> listReceived(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                redEnvelopeService.listReceived(user.getId(), page, size)));
    }
}
