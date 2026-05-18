package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.transfer.*;
import com.aza.backend.entity.User;
import com.aza.backend.service.TransferService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class TransferController {

    private final TransferService transferService;
    private final com.aza.backend.service.StatementService statementService;
    private final com.aza.backend.util.EmailService emailService;

    // ==================== WALLET ====================

    @GetMapping("/wallet/balance")
    public ResponseEntity<ApiResponse<WalletResponse>> getBalance(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(
                transferService.getBalance(user.getId())));
    }

    @GetMapping("/wallet/spending")
    public ResponseEntity<ApiResponse<SpendingResponse>> getSpendingSummary(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(
                transferService.getSpendingSummary(user.getId())));
    }

    @GetMapping("/wallet/spending/yearly")
    public ResponseEntity<ApiResponse<YearlySpendingResponse>> getYearlySpendingSummary(
            @AuthenticationPrincipal User user,
            @RequestParam(required = false) Integer year) {
        int targetYear = year != null ? year : java.time.Year.now().getValue();
        return ResponseEntity.ok(ApiResponse.success(
                transferService.getYearlySpendingSummary(user.getId(), targetYear)));
    }

    // ==================== TRANSFERS ====================

    @PostMapping("/transfers")
    public ResponseEntity<ApiResponse<TransferResponse>> initiateTransfer(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody TransferRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(
                ApiResponse.success(transferService.initiateTransfer(user, request)));
    }

    @PostMapping("/transfers/{id}/confirm")
    public ResponseEntity<ApiResponse<TransferResponse>> confirmTransfer(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id,
            @Valid @RequestBody TransferConfirmRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                transferService.confirmTransfer(user, id, request.getPasscode())));
    }

    @PostMapping("/transfers/{id}/cancel")
    public ResponseEntity<ApiResponse<TransferResponse>> cancelTransfer(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(
                transferService.cancelTransfer(user, id)));
    }

    @GetMapping("/transfers")
    public ResponseEntity<ApiResponse<Page<TransferResponse>>> getTransactions(
            @AuthenticationPrincipal User user,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        int cappedSize = Math.min(size, 100);
        return ResponseEntity.ok(ApiResponse.success(
                transferService.getTransactionHistory(user.getId(), type, status, page, cappedSize)));
    }

    @GetMapping("/transfers/{id}")
    public ResponseEntity<ApiResponse<TransferResponse>> getTransaction(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(
                transferService.getTransaction(id, user.getId())));
    }

    @GetMapping("/transfers/statement")
    public ResponseEntity<byte[]> downloadStatement(
            @AuthenticationPrincipal User user,
            @RequestParam String startDate,
            @RequestParam String endDate) {
        java.time.LocalDateTime start = java.time.LocalDate.parse(startDate).atStartOfDay();
        java.time.LocalDateTime end = java.time.LocalDate.parse(endDate).atTime(23, 59, 59);

        byte[] pdf = statementService.generateStatementPdf(user, start, end);

        return ResponseEntity.ok()
                .header("Content-Type", "application/pdf")
                .header("Content-Disposition", "attachment; filename=statement.pdf")
                .body(pdf);
    }

    @PostMapping("/transfers/statement/email")
    public ResponseEntity<ApiResponse<String>> sendStatementEmail(
            @AuthenticationPrincipal User user,
            @RequestParam String startDate,
            @RequestParam String endDate) {
        java.time.LocalDateTime start = java.time.LocalDate.parse(startDate).atStartOfDay();
        java.time.LocalDateTime end = java.time.LocalDate.parse(endDate).atTime(23, 59, 59);

        byte[] pdf = statementService.generateStatementPdf(user, start, end);
        String period = startDate + " to " + endDate;

        emailService.sendStatement(user.getEmail(), user.getFirstName(), pdf, period);

        return ResponseEntity.ok(ApiResponse.success("Statement sent to your email: " + user.getEmail()));
    }

    // ==================== MONEY REQUESTS ====================

    @PostMapping("/money-requests")
    public ResponseEntity<ApiResponse<TransferResponse>> requestMoney(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody MoneyRequestDto request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(
                ApiResponse.success(transferService.requestMoney(user, request)));
    }

    @PostMapping("/money-requests/{id}/accept")
    public ResponseEntity<ApiResponse<TransferResponse>> acceptRequest(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id,
            @Valid @RequestBody TransferConfirmRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                transferService.acceptMoneyRequest(user, id, request.getPasscode())));
    }

    @PostMapping("/money-requests/{id}/decline")
    public ResponseEntity<ApiResponse<TransferResponse>> declineRequest(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(
                transferService.declineMoneyRequest(user, id)));
    }
}
