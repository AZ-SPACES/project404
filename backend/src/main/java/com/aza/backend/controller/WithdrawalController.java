package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.withdrawal.WithdrawalResponse;
import com.aza.backend.entity.User;
import com.aza.backend.repository.UserWithdrawalRepository;
import com.aza.backend.service.UserWithdrawalService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;

@RestController
@RequestMapping("/api/v1/withdrawals")
@RequiredArgsConstructor
public class WithdrawalController {

    private final UserWithdrawalRepository withdrawalRepository;
    private final UserWithdrawalService withdrawalService;

    public record WithdrawalRequest(
        @NotNull @DecimalMin("1.00") BigDecimal amount,
        @NotBlank @Size(max = 50) String provider,
        @NotBlank @Size(max = 100) String destination,
        @Size(max = 100) String bankName,
        @NotBlank String passcode
    ) {}

    @PostMapping
    public ResponseEntity<ApiResponse<WithdrawalResponse>> requestWithdrawal(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody WithdrawalRequest req) {
        var withdrawal = withdrawalService.request(
                user, req.amount(), req.provider(), req.destination(), req.bankName(), req.passcode());
        return ResponseEntity.ok(ApiResponse.success(WithdrawalResponse.from(withdrawal)));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<Page<WithdrawalResponse>>> listWithdrawals(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<WithdrawalResponse> result = withdrawalRepository
                .findAllByUserIdOrderByCreatedAtDesc(user.getId(), PageRequest.of(page, size))
                .map(WithdrawalResponse::from);
        return ResponseEntity.ok(ApiResponse.success(result));
    }
}
