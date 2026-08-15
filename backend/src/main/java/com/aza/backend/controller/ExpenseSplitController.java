package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.split.BalanceResponse;
import com.aza.backend.dto.split.CreateSplitRequest;
import com.aza.backend.dto.split.SplitResponse;
import com.aza.backend.entity.User;
import com.aza.backend.service.ExpenseSplitService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/splits")
@RequiredArgsConstructor
@Tag(name = "Bill splitting", description = "Dividing a bill one person already paid")
public class ExpenseSplitController {

    private final ExpenseSplitService expenseSplitService;

    @Operation(summary = "Split a bill",
            description = "Works out who owes what and sends each person a payment request "
                    + "for their share. No money moves here — each share is paid through the "
                    + "ordinary payment-request approval, with the usual passcode and limits.")
    @PostMapping
    public ResponseEntity<ApiResponse<SplitResponse>> create(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody CreateSplitRequest request) {
        return ResponseEntity.ok(ApiResponse.success(expenseSplitService.create(user, request)));
    }

    @Operation(summary = "Splits you are part of",
            description = "Both the ones you organised and the ones you owe on, newest first.")
    @GetMapping
    public ResponseEntity<ApiResponse<Page<SplitResponse>>> listMine(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(expenseSplitService.listMine(user, page, size)));
    }

    @Operation(summary = "Where you stand with everyone",
            description = "Nets what each person owes you against what you owe them, so a "
                    + "run of shares in both directions comes down to one number.")
    @GetMapping("/balances")
    public ResponseEntity<ApiResponse<List<BalanceResponse>>> balances(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(expenseSplitService.balances(user)));
    }

    @Operation(summary = "Settle up with one person",
            description = "Collapses every outstanding share between you into a single "
                    + "request for the difference. Either of you can start it; who ends up "
                    + "owing falls out of the arithmetic.")
    @PostMapping("/balances/{userId}/settle")
    public ResponseEntity<ApiResponse<BalanceResponse>> settleUp(
            @AuthenticationPrincipal User user,
            @PathVariable UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(expenseSplitService.settleUp(user, userId)));
    }

    @Operation(summary = "One split in full")
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<SplitResponse>> get(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(expenseSplitService.get(user, id)));
    }

    @Operation(summary = "Forgive someone's share",
            description = "Organiser only. The share counts as settled and they are not asked again.")
    @PostMapping("/{id}/participants/{userId}/waive")
    public ResponseEntity<ApiResponse<SplitResponse>> waive(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id,
            @PathVariable UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(expenseSplitService.waive(user, id, userId)));
    }

    @Operation(summary = "Nudge everyone who still owes", description = "Organiser only.")
    @PostMapping("/{id}/remind")
    public ResponseEntity<ApiResponse<SplitResponse>> remind(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(expenseSplitService.remind(user, id)));
    }

    @Operation(summary = "Call off a split",
            description = "Organiser only. Withdraws every share still outstanding.")
    @PostMapping("/{id}/cancel")
    public ResponseEntity<ApiResponse<SplitResponse>> cancel(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(expenseSplitService.cancel(user, id)));
    }
}
