package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.merchant.HoldInfo;
import com.aza.backend.entity.HoldEvent;
import com.aza.backend.entity.PaymentHold;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.HoldEventRepository;
import com.aza.backend.repository.PaymentHoldRepository;
import com.aza.backend.service.AdminAuditService;
import com.aza.backend.service.HoldLedgerAuditService;
import com.aza.backend.service.HoldService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Back-office view of payment holds.
 *
 * Aza's remit here is deliberately narrow. It can see and explain payment facts, and it can
 * freeze a hold for fraud, sanctions, a frozen account, or a legal order. It cannot decide
 * whether work was done — the integrator holds that decision and the evidence for it
 * (HELD_SETTLEMENT_PLAN §5). There is no "rule for the payer" or "rule for the recipient"
 * action on this controller, and there should never be one.
 */
@RestController
@RequestMapping("/api/v1/admin/holds")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','FINANCE','COMPLIANCE')")
@Tag(name = "Admin Holds", description = "Payment holds: audit trail and compliance controls")
public class AdminHoldController {

    private final PaymentHoldRepository holdRepository;
    private final HoldEventRepository eventRepository;
    private final HoldService holdService;
    private final com.aza.backend.service.HoldExpiryService expiryService;
    private final HoldLedgerAuditService ledgerAuditService;
    private final AdminAuditService auditService;

    @GetMapping
    public ResponseEntity<ApiResponse<Page<HoldInfo>>> list(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PaymentHold.HoldStatus filter = null;
        if (status != null && !status.isBlank()) {
            try {
                filter = PaymentHold.HoldStatus.valueOf(status.toUpperCase());
            } catch (IllegalArgumentException e) {
                throw new AppException("INVALID_STATUS",
                        "status must be one of HELD, RELEASED, REFUNDED, PARTIALLY_SETTLED, FROZEN",
                        HttpStatus.BAD_REQUEST);
            }
        }
        return ResponseEntity.ok(ApiResponse.success(
                holdRepository.findForAdmin(filter, PageRequest.of(page, size))
                        .map(holdService::toInfo)));
    }

    @GetMapping("/summary")
    public ResponseEntity<ApiResponse<Map<String, Object>>> summary() {
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "held", holdRepository.countByStatus(PaymentHold.HoldStatus.HELD),
                "frozen", holdRepository.countByStatus(PaymentHold.HoldStatus.FROZEN),
                "heldFloat", holdRepository.sumActiveHeldFloat())));
    }

    @Operation(summary = "Hold detail with its full settlement audit trail",
            description = "The event log is the complete answer to every question Aza is "
                    + "competent to answer about a hold: was it held, released, refunded, "
                    + "when, by which API key, under which idempotency key.")
    @GetMapping("/{holdId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> detail(@PathVariable UUID holdId) {
        PaymentHold hold = holdRepository.findById(holdId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Hold not found", HttpStatus.NOT_FOUND));
        List<HoldEvent> events = eventRepository.findAllByHoldIdOrderByCreatedAtAsc(holdId);

        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "hold", holdService.toInfo(hold),
                "sessionId", hold.getSessionId().toString(),
                "merchantId", hold.getMerchantId().toString(),
                "payerUserId", hold.getPayerUserId().toString(),
                "frozenReason", hold.getFrozenReason() == null ? "" : hold.getFrozenReason(),
                "events", events)));
    }

    @Operation(summary = "Freeze a hold for compliance",
            description = "Blocks release and refund and stops the expiry clock. For fraud, "
                    + "sanctions, frozen accounts, or legal orders only — never to take a side "
                    + "in a dispute about whether work was done.")
    @PostMapping("/{holdId}/freeze")
    public ResponseEntity<ApiResponse<HoldInfo>> freeze(
            @AuthenticationPrincipal User admin,
            @PathVariable UUID holdId,
            @RequestBody FreezeRequest request) {
        if (request == null || request.getReason() == null || request.getReason().isBlank()) {
            throw new AppException("VALIDATION", "A reason is required to freeze a hold",
                    HttpStatus.BAD_REQUEST);
        }
        PaymentHold hold = holdService.freeze(holdId, request.getReason().trim(), admin.getId());
        // The integrator's release calls start failing the moment this lands; tell them why
        // rather than leaving them to debug their own integration.
        expiryService.notifyStateChange(hold, "hold.frozen");
        auditService.log(admin, "HOLD_FREEZE", null,
                "holdId=" + holdId + " reason=" + request.getReason().trim());
        return ResponseEntity.ok(ApiResponse.success(holdService.toInfo(hold)));
    }

    @Operation(summary = "Lift a compliance freeze",
            description = "Returns the hold to HELD with its window extended by however long it "
                    + "was frozen — an Aza review must not consume the payer's hold period.")
    @PostMapping("/{holdId}/unfreeze")
    public ResponseEntity<ApiResponse<HoldInfo>> unfreeze(
            @AuthenticationPrincipal User admin,
            @PathVariable UUID holdId) {
        PaymentHold hold = holdService.unfreeze(holdId, admin.getId());
        expiryService.notifyStateChange(hold, "hold.unfrozen");
        auditService.log(admin, "HOLD_UNFREEZE", null,
                "holdId=" + holdId + " expiresAt extended to " + hold.getExpiresAt());
        return ResponseEntity.ok(ApiResponse.success(holdService.toInfo(hold)));
    }

    @Operation(summary = "Return a frozen hold's money to the payer",
            description = "The exit from a compliance freeze. Restores the payer to where they "
                    + "started, which is the only outcome Aza can defend on a payment it has "
                    + "decided it should not be holding. Aza never releases a frozen hold to a "
                    + "recipient — deciding someone earned the money is not its call.")
    @PostMapping("/{holdId}/refund")
    @PreAuthorize("hasAnyRole('ADMIN','COMPLIANCE')")
    public ResponseEntity<ApiResponse<HoldInfo>> adminRefund(
            @AuthenticationPrincipal User admin,
            @PathVariable UUID holdId,
            @RequestBody FreezeRequest request) {
        if (request == null || request.getReason() == null || request.getReason().isBlank()) {
            throw new AppException("VALIDATION", "A reason is required to refund a held payment",
                    HttpStatus.BAD_REQUEST);
        }
        PaymentHold hold = holdService.adminRefund(holdId, request.getReason().trim(), admin.getId());
        auditService.log(admin, "HOLD_ADMIN_REFUND", null,
                "holdId=" + holdId + " reason=" + request.getReason().trim());
        return ResponseEntity.ok(ApiResponse.success(holdService.toInfo(hold)));
    }

    @Operation(summary = "Run the hold ledger invariant now",
            description = "Normally runs nightly. Compares every settled hold's totals against "
                    + "its append-only event log and opens a recon break on any disagreement.")
    @PostMapping("/audit-ledger")
    @PreAuthorize("hasAnyRole('ADMIN','FINANCE')")
    public ResponseEntity<ApiResponse<HoldLedgerAuditService.AuditResult>> auditLedger(
            @AuthenticationPrincipal User admin) {
        HoldLedgerAuditService.AuditResult result = ledgerAuditService.verifyLedger();
        auditService.log(admin, "HOLD_LEDGER_AUDIT", null,
                "checked=" + result.holdsChecked() + " breaks=" + result.breaksOpened());
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @Data
    public static class FreezeRequest {
        private String reason;
    }
}
