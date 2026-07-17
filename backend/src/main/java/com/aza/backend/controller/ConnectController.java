package com.aza.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.connect.ConnectBalanceResponse;
import com.aza.backend.dto.connect.ConnectRecipientResponse;
import com.aza.backend.dto.connect.ConnectTransferRequest;
import com.aza.backend.dto.connect.ConnectTransferResponse;
import com.aza.backend.dto.merchant.BulkTransferResponse;
import com.aza.backend.dto.merchant.CreateBulkTransferRequest;
import com.aza.backend.entity.Merchant;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.MerchantRepository;
import com.aza.backend.security.filter.MerchantApiKeyFilter;
import com.aza.backend.service.BulkTransferService;
import com.aza.backend.service.ConnectService;
import io.swagger.v3.oas.annotations.Parameter;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Aza Connect — the marketplace API a platform uses to pay its sellers. Authenticated
 * with a merchant API key (X-Api-Key) exactly like the /sessions endpoints, so it works
 * for both live and sandbox (aza_test_) keys.
 */
@RestController
@RequestMapping("/api/v1/merchant/connect")
@RequiredArgsConstructor
@Tag(name = "Connect", description = "Marketplace payouts — pay individual sellers from your platform balance")
public class ConnectController {

    private final ConnectService connectService;
    private final BulkTransferService bulkTransferService;
    private final MerchantRepository merchantRepository;

    @Operation(summary = "Platform balance", description = "Funds available to pay out to sellers.")
    @GetMapping("/balance")
    public ResponseEntity<ApiResponse<ConnectBalanceResponse>> balance(
            @Parameter(hidden = true) @AuthenticationPrincipal Object principal) {
        return ResponseEntity.ok(ApiResponse.success(connectService.getBalance(resolveMerchantId(principal))));
    }

    @Operation(summary = "Resolve a seller",
            description = "Check that a seller's Aza account exists and can receive money before paying them. "
                    + "Returns only existence, a masked display name, and whether they can be paid.")
    @GetMapping("/recipients/resolve")
    public ResponseEntity<ApiResponse<ConnectRecipientResponse>> resolve(
            @Parameter(hidden = true) @AuthenticationPrincipal Object principal,
            @RequestParam String identifier) {
        return ResponseEntity.ok(ApiResponse.success(
                connectService.resolveRecipient(resolveMerchantId(principal), identifier)));
    }

    @Operation(summary = "Pay a seller",
            description = "Move funds from your platform balance to a single seller's Aza wallet. "
                    + "With an aza_test_ key the request is fully validated but no money moves.")
    @PostMapping("/transfers")
    public ResponseEntity<ApiResponse<ConnectTransferResponse>> transfer(
            @Parameter(hidden = true) @AuthenticationPrincipal Object principal,
            @Parameter(hidden = true) @RequestAttribute(name = MerchantApiKeyFilter.API_KEY_ENVIRONMENT_ATTR, required = false) String keyEnvironment,
            @Valid @RequestBody ConnectTransferRequest request) {
        boolean testMode = "TEST".equalsIgnoreCase(keyEnvironment);
        ConnectTransferResponse result = connectService.transfer(resolveMerchantId(principal), testMode, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(result));
    }

    @Operation(summary = "Pay many sellers at once",
            description = "Disburse to up to 100 sellers in one call. Live keys only.")
    @PostMapping("/transfers/bulk")
    public ResponseEntity<ApiResponse<BulkTransferResponse>> bulkTransfer(
            @Parameter(hidden = true) @AuthenticationPrincipal Object principal,
            @Parameter(hidden = true) @RequestAttribute(name = MerchantApiKeyFilter.API_KEY_ENVIRONMENT_ATTR, required = false) String keyEnvironment,
            @Valid @RequestBody CreateBulkTransferRequest request) {
        if ("TEST".equalsIgnoreCase(keyEnvironment)) {
            throw new AppException("BULK_NOT_SANDBOXED",
                    "Bulk transfers are not available in test mode. Use POST /connect/transfers with your test key to simulate a single payout.",
                    HttpStatus.BAD_REQUEST);
        }
        BulkTransferResponse result = bulkTransferService.createBulkTransfer(resolveMerchantId(principal), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(result));
    }

    @Operation(summary = "List payouts")
    @GetMapping("/transfers")
    public ResponseEntity<ApiResponse<Page<ConnectTransferResponse>>> listTransfers(
            @Parameter(hidden = true) @AuthenticationPrincipal Object principal,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                connectService.listTransfers(resolveMerchantId(principal), page, size)));
    }

    @Operation(summary = "Get a payout")
    @GetMapping("/transfers/{id}")
    public ResponseEntity<ApiResponse<ConnectTransferResponse>> getTransfer(
            @Parameter(hidden = true) @AuthenticationPrincipal Object principal,
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(
                connectService.getTransfer(resolveMerchantId(principal), id)));
    }

    // Resolve the calling merchant from either an API-key principal (Merchant) or a
    // dashboard JWT principal (User) — mirrors MerchantController.
    private UUID resolveMerchantId(Object principal) {
        if (principal instanceof Merchant merchant) {
            return merchant.getId();
        }
        if (principal instanceof User user) {
            return merchantRepository.findByUserId(user.getId())
                    .orElseThrow(() -> new AppException("NOT_FOUND", "No merchant account found", HttpStatus.NOT_FOUND))
                    .getId();
        }
        throw new AppException("UNAUTHORIZED", "Not authenticated", HttpStatus.UNAUTHORIZED);
    }
}
