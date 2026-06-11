package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.admin.FeeRuleResponse;
import com.aza.backend.dto.admin.FeeStatsResponse;
import com.aza.backend.service.FeeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/fees")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','FINANCE')")
public class AdminFeeController {

    private final FeeService feeService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<FeeRuleResponse>>> getFeeRules() {
        return ResponseEntity.ok(ApiResponse.success(feeService.getFeeRules()));
    }

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<FeeStatsResponse>> getStats() {
        return ResponseEntity.ok(ApiResponse.success(feeService.getStats()));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<ApiResponse<FeeRuleResponse>> updateRule(
            @PathVariable UUID id,
            @RequestBody FeeService.FeeRuleUpdateRequest request) {
        return ResponseEntity.ok(ApiResponse.success(feeService.updateRule(id, request)));
    }
}
