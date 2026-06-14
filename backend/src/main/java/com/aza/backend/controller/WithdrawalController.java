package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.entity.User;
import com.aza.backend.entity.UserWithdrawal;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.UserWithdrawalRepository;
import com.aza.backend.repository.WalletRepository;
import com.aza.backend.service.UserService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/withdrawals")
@RequiredArgsConstructor
public class WithdrawalController {

    private final UserWithdrawalRepository withdrawalRepository;
    private final WalletRepository walletRepository;
    private final UserService userService;

    public record WithdrawalRequest(
        @NotNull @DecimalMin("1.00") BigDecimal amount,
        @NotBlank @Size(max = 50) String provider,
        @NotBlank @Size(max = 100) String destination,
        @Size(max = 100) String bankName,
        @NotBlank String passcode
    ) {}

    @PostMapping
    public ResponseEntity<ApiResponse<UserWithdrawal>> requestWithdrawal(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody WithdrawalRequest req) {

        userService.verifyPasscode(user, req.passcode());

        var wallet = walletRepository.findByUserId(user.getId())
                .orElseThrow(() -> new AppException("NO_WALLET", "Wallet not found", HttpStatus.NOT_FOUND));

        if (wallet.getBalance() == null || wallet.getBalance().compareTo(req.amount()) < 0) {
            throw new AppException("INSUFFICIENT_FUNDS", "Insufficient balance for this withdrawal", HttpStatus.BAD_REQUEST);
        }

        var withdrawal = UserWithdrawal.builder()
                .userId(user.getId())
                .amount(req.amount())
                .provider(req.provider())
                .destination(req.destination())
                .bankName(req.bankName())
                .status(UserWithdrawal.WithdrawalStatus.PENDING)
                .build();

        return ResponseEntity.ok(ApiResponse.success(withdrawalRepository.save(withdrawal)));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<Page<UserWithdrawal>>> listWithdrawals(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                withdrawalRepository.findAllByUserIdOrderByCreatedAtDesc(user.getId(), PageRequest.of(page, size))));
    }
}
