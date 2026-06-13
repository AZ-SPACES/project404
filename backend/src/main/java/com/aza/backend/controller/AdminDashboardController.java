package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.admin.AdminStatsResponse;
import com.aza.backend.dto.admin.AdminTransactionResponse;
import com.aza.backend.dto.admin.ApprovalResponse;
import com.aza.backend.dto.admin.LiveStatsResponse;
import com.aza.backend.entity.PendingApproval;
import com.aza.backend.entity.User;
import com.aza.backend.service.AdminService;
import com.aza.backend.service.ApprovalService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/dashboard")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','SUPPORT','COMPLIANCE','FINANCE')")
public class AdminDashboardController {

    private final AdminService adminService;
    private final ApprovalService approvalService;

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<AdminStatsResponse>> getStats() {
        return ResponseEntity.ok(ApiResponse.success(adminService.getStats()));
    }

    @GetMapping("/transactions")
    public ResponseEntity<ApiResponse<Page<AdminTransactionResponse>>> getTransactions(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        boolean hasFilters = query != null || status != null || type != null || from != null || to != null;
        if (hasFilters) {
            return ResponseEntity.ok(ApiResponse.success(
                    adminService.searchTransactions(query, status, type, from, to, page, Math.min(size, 50))));
        }
        return ResponseEntity.ok(ApiResponse.success(adminService.getTransactions(page, Math.min(size, 50))));
    }

    @GetMapping(value = "/transactions/export", produces = "text/csv")
    @PreAuthorize("hasAnyRole('ADMIN','FINANCE')")
    public ResponseEntity<String> exportTransactions(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        List<AdminTransactionResponse> rows = adminService.exportTransactions(status, type, from, to);
        StringBuilder csv = new StringBuilder("id,sender,senderHandle,recipient,recipientHandle,amount,type,status,initiatedAt,completedAt,category\n");
        for (AdminTransactionResponse r : rows) {
            csv.append(escapeCsv(r.getId())).append(",")
               .append(escapeCsv(r.getSenderName())).append(",")
               .append(escapeCsv(r.getSenderHandle())).append(",")
               .append(escapeCsv(r.getRecipientName())).append(",")
               .append(escapeCsv(r.getRecipientHandle())).append(",")
               .append(r.getAmount()).append(",")
               .append(escapeCsv(r.getType())).append(",")
               .append(escapeCsv(r.getStatus())).append(",")
               .append(r.getInitiatedAt() != null ? r.getInitiatedAt().toString() : "").append(",")
               .append(r.getCompletedAt() != null ? r.getCompletedAt().toString() : "").append(",")
               .append(escapeCsv(r.getCategory())).append("\n");
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"transactions.csv\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csv.toString());
    }

    private static String escapeCsv(String v) {
        if (v == null) return "";
        if (v.contains(",") || v.contains("\"") || v.contains("\n")) return "\"" + v.replace("\"", "\"\"") + "\"";
        return v;
    }

    @GetMapping("/transactions/{id}")
    public ResponseEntity<ApiResponse<AdminTransactionResponse>> getTransaction(
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(adminService.getTransactionById(id)));
    }

    @GetMapping("/live-stats")
    public ResponseEntity<ApiResponse<LiveStatsResponse>> getLiveStats() {
        return ResponseEntity.ok(ApiResponse.success(adminService.getLiveStats()));
    }

    /** Maker-checker: submits a reversal request; a second FINANCE/ADMIN must approve. */
    @PreAuthorize("hasAnyRole('ADMIN','FINANCE')")
    @PostMapping("/transactions/{id}/reverse")
    public ResponseEntity<ApiResponse<ApprovalResponse>> reverseTransaction(
            @PathVariable UUID id,
            @AuthenticationPrincipal User admin) {
        AdminTransactionResponse tx = adminService.getTransactionById(id);
        return ResponseEntity.ok(ApiResponse.success(approvalService.submit(
                admin, PendingApproval.ActionType.REVERSE_TRANSACTION, id, null,
                "Reverse transaction of GHS " + tx.getAmount() + " from "
                        + tx.getSenderName() + " to " + tx.getRecipientName())));
    }
}
