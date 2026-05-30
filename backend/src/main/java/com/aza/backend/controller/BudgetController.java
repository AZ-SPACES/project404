package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.transfer.BudgetRequest;
import com.aza.backend.dto.transfer.BudgetResponse;
import com.aza.backend.entity.User;
import com.aza.backend.service.BudgetService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/budgets")
@RequiredArgsConstructor
public class BudgetController {

    private final BudgetService budgetService;
    private static final ZoneId GHANA_TZ = ZoneId.of("Africa/Accra");

    @GetMapping
    public ResponseEntity<ApiResponse<List<BudgetResponse>>> getBudgets(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(budgetService.getBudgets(user.getId())));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<BudgetResponse>> createOrUpdateBudget(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody BudgetRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                budgetService.createOrUpdateBudget(user.getId(), request)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<String>> deleteBudget(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id) {
        budgetService.deleteBudget(user.getId(), id);
        return ResponseEntity.ok(ApiResponse.success("Budget deleted"));
    }

    @GetMapping("/status")
    public ResponseEntity<ApiResponse<List<BudgetResponse>>> getBudgetStatus(
            @AuthenticationPrincipal User user,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        LocalDateTime now = LocalDateTime.now(GHANA_TZ);
        LocalDateTime start = startDate != null
                ? LocalDate.parse(startDate).atStartOfDay()
                : now.withDayOfMonth(1).toLocalDate().atStartOfDay();
        LocalDateTime end = endDate != null
                ? LocalDate.parse(endDate).plusDays(1).atStartOfDay()
                : now.plusDays(1).toLocalDate().atStartOfDay();
        return ResponseEntity.ok(ApiResponse.success(
                budgetService.getBudgetStatus(user.getId(), start, end)));
    }
}
