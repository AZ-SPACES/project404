package com.aza.backend.service;

import com.aza.backend.dto.agent.WithdrawalCodeResponse;
import com.aza.backend.entity.User;
import com.aza.backend.entity.Wallet;
import com.aza.backend.entity.WithdrawalCode;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.WalletRepository;
import com.aza.backend.repository.WithdrawalCodeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;

/**
 * Generates and validates one-time cash-out codes. Only the SHA-256 hash of a code
 * is persisted; the plaintext is returned to the customer once at generation.
 */
@Service
@RequiredArgsConstructor
public class WithdrawalCodeService {

    /** Unambiguous alphabet (no 0/O/1/I) for codes a teller might read aloud. */
    private static final char[] ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ".toCharArray();
    private static final int CODE_LENGTH = 10;
    private static final int TTL_MINUTES = 15;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final WithdrawalCodeRepository withdrawalCodeRepository;
    private final WalletRepository walletRepository;
    private final FeeCalculationService feeCalculationService;

    @Transactional
    public WithdrawalCodeResponse generate(User user, BigDecimal amount) {
        if (amount == null || amount.signum() <= 0) {
            throw new AppException("INVALID_AMOUNT", "Amount must be greater than zero", HttpStatus.BAD_REQUEST);
        }
        BigDecimal fee = feeCalculationService.quote("CASH_OUT", amount, user.getId()).fee();

        Wallet wallet = walletRepository.findByUserId(user.getId())
                .orElseThrow(() -> new AppException("Wallet not found"));
        if (wallet.getBalance().compareTo(amount.add(fee)) < 0) {
            throw new AppException("INSUFFICIENT_FUNDS",
                    "Balance is too low to cover this withdrawal plus its fee", HttpStatus.BAD_REQUEST);
        }

        String plaintext = randomCode();
        LocalDateTime expiresAt = LocalDateTime.now().plusMinutes(TTL_MINUTES);
        withdrawalCodeRepository.save(WithdrawalCode.builder()
                .userId(user.getId())
                .amount(amount)
                .codeHash(sha256Hex(plaintext))
                .status(WithdrawalCode.Status.ACTIVE)
                .expiresAt(expiresAt)
                .build());

        return WithdrawalCodeResponse.builder()
                .code(plaintext)
                .amount(amount)
                .estimatedFee(fee)
                .expiresAt(expiresAt.toString())
                .currency("GHS")
                .build();
    }

    /**
     * Validates a presented code and marks it redeemed. Runs inside the caller's
     * cash-out transaction, so if the money move later fails the redemption rolls back.
     */
    @Transactional
    public WithdrawalCode consume(String rawCode, java.util.UUID agentUserId) {
        if (rawCode == null || rawCode.isBlank()) {
            throw new AppException("INVALID_CODE", "A withdrawal code is required", HttpStatus.BAD_REQUEST);
        }
        WithdrawalCode code = withdrawalCodeRepository
                .findByCodeHash(sha256Hex(rawCode.trim().toUpperCase()))
                .orElseThrow(() -> new AppException("INVALID_CODE", "Withdrawal code not recognised", HttpStatus.NOT_FOUND));

        if (code.getStatus() != WithdrawalCode.Status.ACTIVE) {
            throw new AppException("CODE_NOT_ACTIVE", "This code has already been used or cancelled", HttpStatus.CONFLICT);
        }
        if (LocalDateTime.now().isAfter(code.getExpiresAt())) {
            code.setStatus(WithdrawalCode.Status.EXPIRED);
            withdrawalCodeRepository.save(code);
            throw new AppException("CODE_EXPIRED", "This withdrawal code has expired", HttpStatus.CONFLICT);
        }

        code.setStatus(WithdrawalCode.Status.REDEEMED);
        code.setRedeemedByAgentId(agentUserId);
        code.setRedeemedAt(LocalDateTime.now());
        return withdrawalCodeRepository.save(code);
    }

    private static String randomCode() {
        StringBuilder sb = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            sb.append(ALPHABET[RANDOM.nextInt(ALPHABET.length)]);
        }
        return sb.toString();
    }

    private static String sha256Hex(String input) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                hex.append(Character.forDigit((b >> 4) & 0xF, 16));
                hex.append(Character.forDigit(b & 0xF, 16));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
