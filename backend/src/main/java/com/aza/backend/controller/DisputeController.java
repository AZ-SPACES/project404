package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.admin.DisputeResponse;
import com.aza.backend.entity.User;
import com.aza.backend.service.DisputeService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/disputes")
@RequiredArgsConstructor
public class DisputeController {

    private final DisputeService disputeService;

    @PostMapping
    public ResponseEntity<ApiResponse<DisputeResponse>> createDispute(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody CreateDisputeRequest request) {
        DisputeResponse response = disputeService.createDispute(
                request.getTransactionId(),
                request.getCategory(),
                request.getDescription(),
                user
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<Page<DisputeResponse>>> getUserDisputes(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<DisputeResponse> response = disputeService.getUserDisputes(user.getId(), page, size);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @Data
    public static class CreateDisputeRequest {
        @NotNull(message = "Transaction ID is required")
        private UUID transactionId;

        @NotBlank(message = "Category is required")
        private String category;

        @NotBlank(message = "Description is required")
        private String description;
    }
}
