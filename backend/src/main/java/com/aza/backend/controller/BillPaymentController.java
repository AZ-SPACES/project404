package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.bill.BillPaymentResponse;
import com.aza.backend.dto.bill.BillerResponse;
import com.aza.backend.dto.bill.PayBillRequest;
import com.aza.backend.entity.Biller;
import com.aza.backend.entity.User;
import com.aza.backend.service.BillPaymentService;
import com.aza.backend.service.biller.BillerProvider;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/bills")
@RequiredArgsConstructor
@Tag(name = "Bill payments", description = "Utilities, airtime, and government fees")
public class BillPaymentController {

    private final BillPaymentService billPaymentService;

    @Operation(summary = "Billers you can pay")
    @GetMapping("/billers")
    public ResponseEntity<ApiResponse<List<BillerResponse>>> billers(
            @RequestParam(required = false) String category) {
        List<BillerResponse> billers = billPaymentService.billers(category).stream()
                .map(BillPaymentController::toResponse)
                .toList();
        return ResponseEntity.ok(ApiResponse.success(billers));
    }

    @Operation(summary = "Check who an account belongs to",
            description = "Resolves the account holder's name before any money moves, so a "
                    + "mistyped number is caught before it pays a stranger's bill.")
    @GetMapping("/billers/{slug}/lookup")
    public ResponseEntity<ApiResponse<Map<String, Object>>> lookup(
            @AuthenticationPrincipal User user,
            @PathVariable String slug,
            @RequestParam String account) {
        BillerProvider.AccountLookup result = billPaymentService.lookup(user, slug, account);
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "supported", result.supported(),
                "found", result.found(),
                "name", result.name() == null ? "" : result.name())));
    }

    @Operation(summary = "Pay a bill",
            description = "Debits your wallet, then pays the biller. If the biller refuses, "
                    + "the money comes straight back.")
    @PostMapping("/pay")
    public ResponseEntity<ApiResponse<BillPaymentResponse>> pay(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody PayBillRequest request) {
        return ResponseEntity.ok(ApiResponse.success(billPaymentService.pay(user, request)));
    }

    @Operation(summary = "Bills you have paid")
    @GetMapping
    public ResponseEntity<ApiResponse<Page<BillPaymentResponse>>> history(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(billPaymentService.history(user.getId(), page, size)));
    }

    @Operation(summary = "One payment, with its token or receipt")
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<BillPaymentResponse>> get(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(billPaymentService.get(user, id)));
    }

    private static BillerResponse toResponse(Biller b) {
        return BillerResponse.builder()
                .slug(b.getSlug())
                .name(b.getName())
                .category(b.getCategory().name())
                .logoUrl(b.getLogoUrl())
                .accountLabel(b.getAccountLabel())
                .minAmount(b.getMinAmount())
                .maxAmount(b.getMaxAmount())
                .supportsNameLookup(b.isSupportsNameLookup())
                .build();
    }
}
