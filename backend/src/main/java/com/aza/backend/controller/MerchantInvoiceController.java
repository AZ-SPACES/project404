package com.aza.backend.controller;

import io.swagger.v3.oas.annotations.tags.Tag;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.merchant.CreateInvoiceRequest;
import com.aza.backend.dto.merchant.InvoiceResponse;
import com.aza.backend.dto.merchant.UpdateInvoiceRequest;
import com.aza.backend.service.MerchantService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/merchant/invoices")
@RequiredArgsConstructor
@Tag(name = "Merchant Invoices", description = "Issue and manage invoices")
public class MerchantInvoiceController {

    private final MerchantService merchantService;

    // All handlers accept both principal types: User (dashboard JWT) and Merchant
    // (MerchantApiKeyFilter) — this path is on the filter's activated list.

    @GetMapping
    public ResponseEntity<ApiResponse<Page<InvoiceResponse>>> list(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal Object principal,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                merchantService.listInvoices(PrincipalResolver.ownerUserId(principal), page, size)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<InvoiceResponse>> create(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal Object principal,
            @Valid @RequestBody CreateInvoiceRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(
                        merchantService.createInvoice(PrincipalResolver.ownerUserId(principal), request)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<InvoiceResponse>> update(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal Object principal,
            @PathVariable UUID id,
            @RequestBody UpdateInvoiceRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                merchantService.updateInvoice(PrincipalResolver.ownerUserId(principal), id, request)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> cancel(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal Object principal,
            @PathVariable UUID id) {
        merchantService.cancelInvoice(PrincipalResolver.ownerUserId(principal), id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/{id}/send")
    public ResponseEntity<ApiResponse<InvoiceResponse>> send(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal Object principal,
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(
                merchantService.sendInvoice(PrincipalResolver.ownerUserId(principal), id)));
    }
}
