package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.transfer.CreateRecurringTransferRequest;
import com.aza.backend.dto.transfer.RecurringTransferResponse;
import com.aza.backend.entity.User;
import com.aza.backend.service.RecurringTransferService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/recurring-transfers")
@RequiredArgsConstructor
public class RecurringTransferController {

    private final RecurringTransferService recurringTransferService;

    @PostMapping
    public ResponseEntity<ApiResponse<RecurringTransferResponse>> create(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody CreateRecurringTransferRequest request) {
        RecurringTransferResponse response = recurringTransferService.create(user.getId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<RecurringTransferResponse>>> list(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(recurringTransferService.list(user.getId())));
    }

    @PutMapping("/{id}/pause")
    public ResponseEntity<ApiResponse<RecurringTransferResponse>> pause(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(recurringTransferService.pause(user.getId(), id)));
    }

    @PutMapping("/{id}/resume")
    public ResponseEntity<ApiResponse<RecurringTransferResponse>> resume(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(recurringTransferService.resume(user.getId(), id)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<String>> cancel(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id) {
        recurringTransferService.cancel(user.getId(), id);
        return ResponseEntity.ok(ApiResponse.success("Recurring transfer cancelled"));
    }
}
