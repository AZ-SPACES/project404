package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.FeeQuoteResponse;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.service.FeeCalculationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;

/**
 * Consumer-facing fee preview. Drives the "Fee: GHS 0.00" line the app shows
 * before the user confirms a transaction.
 */
@RestController
@RequestMapping("/api/v1/fees")
@RequiredArgsConstructor
public class FeeController {

    private final FeeCalculationService feeCalculationService;

    @GetMapping("/quote")
    public ResponseEntity<ApiResponse<FeeQuoteResponse>> quote(
            @RequestParam String type,
            @RequestParam BigDecimal amount,
            @AuthenticationPrincipal User user) {

        if (type == null || type.isBlank()) {
            throw new AppException("INVALID_TYPE", "Transaction type is required", HttpStatus.BAD_REQUEST);
        }
        if (amount == null || amount.signum() <= 0) {
            throw new AppException("INVALID_AMOUNT", "Amount must be greater than zero", HttpStatus.BAD_REQUEST);
        }

        FeeCalculationService.FeeQuote q = feeCalculationService.quote(
                type.toUpperCase(), amount, user != null ? user.getId() : null);

        return ResponseEntity.ok(ApiResponse.success(FeeQuoteResponse.builder()
                .transactionType(type.toUpperCase())
                .amount(amount)
                .fee(q.fee())
                .free(q.free())
                .currency("GHS")
                .ruleId(q.ruleId() != null ? q.ruleId().toString() : null)
                .build()));
    }
}
