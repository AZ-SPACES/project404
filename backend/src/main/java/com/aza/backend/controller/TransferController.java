package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.admin.AdminTransactionResponse;
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

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class TransferController {

    private final TransferService transferService;
    private final com.aza.backend.service.StatementService statementService;
    private final com.aza.backend.util.EmailService emailService;
    private final com.aza.backend.service.NotificationService notificationService;
    private final com.aza.backend.service.SystemSettingService settingService;
    private final com.aza.backend.repository.LimitIncreaseRequestRepository limitRequestRepo;

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

    @GetMapping("/wallet/today-sent")
    public ResponseEntity<ApiResponse<java.util.Map<String, Object>>> getTodaySent(
            @AuthenticationPrincipal User user) {
        java.math.BigDecimal sent = transferService.getTodaySent(user.getId());
        return ResponseEntity.ok(ApiResponse.success(java.util.Map.of(
                "sentToday", sent,
                "currency", "GHS")));
    }

    @lombok.Data
    static class LimitIncreaseRequest {
        private java.math.BigDecimal requestedDailyLimitGhs;
        private java.math.BigDecimal requestedSingleTransactionLimitGhs;
        private String reason;
    }

    @PostMapping("/users/me/limits/request")
    public ResponseEntity<ApiResponse<String>> requestLimitIncrease(
            @AuthenticationPrincipal User user,
            @RequestBody LimitIncreaseRequest body) {
        com.aza.backend.dto.admin.SystemSettingsResponse settings = settingService.getSettings();
        java.math.BigDecimal currentDaily = user.getCustomDailyLimitGhs() != null
                ? user.getCustomDailyLimitGhs() : settings.getMaxDailyTransferGhs();
        java.math.BigDecimal currentSingle = user.getCustomSingleTransactionLimitGhs() != null
                ? user.getCustomSingleTransactionLimitGhs() : settings.getMaxSingleTransactionGhs();

        limitRequestRepo.save(com.aza.backend.entity.LimitIncreaseRequest.builder()
                .userId(user.getId())
                .currentDailyLimitGhs(currentDaily)
                .currentSingleTransactionLimitGhs(currentSingle)
                .requestedDailyLimitGhs(body.getRequestedDailyLimitGhs() != null
                        ? body.getRequestedDailyLimitGhs() : currentDaily)
                .requestedSingleTransactionLimitGhs(body.getRequestedSingleTransactionLimitGhs() != null
                        ? body.getRequestedSingleTransactionLimitGhs() : currentSingle)
                .reason(body.getReason())
                .build());

        notificationService.sendNotification(
                user.getId(),
                com.aza.backend.entity.Notification.NotificationType.SYSTEM_BROADCAST,
                "Limit increase request received",
                "We've received your request and will review it within 2 business days.",
                null, null);
        return ResponseEntity.ok(ApiResponse.success("Request submitted successfully."));
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

    @GetMapping("/transfers/statement/csv")
    public ResponseEntity<byte[]> downloadStatementCsv(
            @AuthenticationPrincipal User user,
            @RequestParam String startDate,
            @RequestParam String endDate) {
        java.time.LocalDateTime start = java.time.LocalDate.parse(startDate).atStartOfDay();
        java.time.LocalDateTime end = java.time.LocalDate.parse(endDate).atTime(23, 59, 59);

        byte[] csv = statementService.generateStatementCsv(user, start, end);

        return ResponseEntity.ok()
                .header("Content-Type", "text/csv; charset=UTF-8")
                .header("Content-Disposition", "attachment; filename=statement.csv")
                .body(csv);
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

    // ==================== TASK 1: TRANSACTION SEARCH ====================

    @GetMapping("/transfers/search")
    public ResponseEntity<ApiResponse<Page<AdminTransactionResponse>>> searchTransactions(
            @AuthenticationPrincipal User user,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) BigDecimal minAmount,
            @RequestParam(required = false) BigDecimal maxAmount,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        java.time.LocalDateTime start = startDate != null ? LocalDate.parse(startDate).atStartOfDay() : null;
        java.time.LocalDateTime end = endDate != null ? LocalDate.parse(endDate).plusDays(1).atStartOfDay() : null;
        return ResponseEntity.ok(ApiResponse.success(
                transferService.searchTransactions(user.getId(), status, type, minAmount, maxAmount, start, end, page, size)));
    }

    // ==================== TASK 2: WALLET FREEZE/UNFREEZE ====================

    @PostMapping("/users/me/wallet/freeze")
    public ResponseEntity<ApiResponse<Map<String, Object>>> freezeWallet(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(transferService.freezeWallet(user.getId())));
    }

    @PostMapping("/users/me/wallet/unfreeze")
    public ResponseEntity<ApiResponse<Map<String, Object>>> unfreezeWallet(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(transferService.unfreezeWallet(user.getId())));
    }

    @GetMapping("/users/me/wallet/status")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getWalletStatus(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(transferService.getWalletStatus(user.getId())));
    }

    // ==================== TASK 3: SPENDING CATEGORIES ====================

    @GetMapping("/wallet/spending/categories")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getSpendingCategories(
            @AuthenticationPrincipal User user,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        java.time.LocalDateTime start = startDate != null
                ? LocalDate.parse(startDate).atStartOfDay()
                : java.time.LocalDateTime.now().withDayOfMonth(1).toLocalDate().atStartOfDay();
        java.time.LocalDateTime end = endDate != null
                ? LocalDate.parse(endDate).plusDays(1).atStartOfDay()
                : start.plusMonths(1);
        return ResponseEntity.ok(ApiResponse.success(
                transferService.getSpendingCategories(user.getId(), start, end)));
    }

    // ==================== TASK 7: USER-FACING BULK TRANSFER ====================

    @lombok.Data
    static class BulkTransferItem {
        private String recipientIdentifier;
        private BigDecimal amount;
        private String note;
    }

    @lombok.Data
    static class BulkTransferRequest {
        private java.util.List<BulkTransferItem> transfers;
        private String idempotencyKey;
    }

    @PostMapping("/transfers/bulk")
    public ResponseEntity<ApiResponse<Map<String, Object>>> bulkTransfer(
            @AuthenticationPrincipal User user,
            @RequestBody BulkTransferRequest body) {
        java.util.List<Map<String, Object>> results = new java.util.ArrayList<>();
        int successCount = 0;
        int failureCount = 0;
        BigDecimal totalDebited = BigDecimal.ZERO;

        for (BulkTransferItem item : body.getTransfers()) {
            try {
                TransferResponse resp = transferService.executeSingleBulkItem(
                        user, item.getRecipientIdentifier(), item.getAmount(), item.getNote());
                results.add(java.util.Map.of(
                        "recipientIdentifier", item.getRecipientIdentifier(),
                        "amount", item.getAmount(),
                        "status", "SUCCESS",
                        "transactionId", resp.getId()));
                successCount++;
                totalDebited = totalDebited.add(item.getAmount());
            } catch (Exception e) {
                results.add(java.util.Map.of(
                        "recipientIdentifier", item.getRecipientIdentifier(),
                        "amount", item.getAmount(),
                        "status", "FAILED",
                        "error", e.getMessage() != null ? e.getMessage() : "Unknown error"));
                failureCount++;
            }
        }

        return ResponseEntity.ok(ApiResponse.success(java.util.Map.of(
                "results", results,
                "successCount", successCount,
                "failureCount", failureCount,
                "totalDebited", totalDebited)));
    }
}
