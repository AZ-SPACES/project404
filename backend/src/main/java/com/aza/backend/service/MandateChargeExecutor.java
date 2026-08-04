package com.aza.backend.service;

import com.aza.backend.entity.*;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;

/**
 * The actual money movement for a mandate charge — debit payer, credit merchant net of fee,
 * write the Transaction + MandateCharge rows, all in one transaction that either fully commits
 * or leaves no trace. Kept as its own bean (not a method on PaymentMandateService) so callers
 * outside this package go through the Spring proxy and @Transactional actually applies;
 * PaymentMandateService.charge() calls this as an external bean, not a self-invocation.
 */
@Service
@RequiredArgsConstructor
class MandateChargeExecutor {

    private final PaymentMandateRepository mandateRepository;
    private final MandateChargeRepository chargeRepository;
    private final UserRepository userRepository;
    private final MerchantRepository merchantRepository;
    private final WalletRepository walletRepository;
    private final TransactionRepository transactionRepository;

    @Transactional
    MandateCharge execute(PaymentMandate mandate, BigDecimal amount, String reference, String idempotencyKey) {
        // Lazy expiry is flipped by the caller (PaymentMandateService.charge()) before this
        // method runs, specifically so the status change survives a rejection here rather than
        // rolling back with it — this method only needs to read the (already up to date) status.
        if (mandate.getStatus() != PaymentMandate.Status.ACTIVE) {
            throw new AppException("MANDATE_NOT_ACTIVE",
                    "Mandate is " + mandate.getStatus().name().toLowerCase() + " and cannot be charged",
                    HttpStatus.CONFLICT);
        }
        if (amount.compareTo(mandate.getPerChargeLimit()) > 0) {
            throw new AppException("MANDATE_CEILING_EXCEEDED",
                    "Amount exceeds the mandate's per-charge limit of GHS " + mandate.getPerChargeLimit(),
                    HttpStatus.BAD_REQUEST);
        }

        // Lazy period reset: a charge landing after the window has elapsed starts a fresh one,
        // same "check on read" approach CheckoutSession expiry already uses in this codebase.
        if (mandate.getPeriodLimit() != null) {
            LocalDateTime now = LocalDateTime.now();
            if (mandate.getPeriodResetAt() == null || !now.isBefore(mandate.getPeriodResetAt())) {
                mandate.setPeriodSpent(BigDecimal.ZERO);
                mandate.setPeriodResetAt(nextPeriodReset(now, mandate.getPeriodType()));
            }
            if (mandate.getPeriodSpent().add(amount).compareTo(mandate.getPeriodLimit()) > 0) {
                throw new AppException("MANDATE_PERIOD_LIMIT_EXCEEDED",
                        "Charge would exceed the mandate's " + mandate.getPeriodType().name().toLowerCase()
                                + " limit of GHS " + mandate.getPeriodLimit(),
                        HttpStatus.BAD_REQUEST);
            }
        }

        User payer = userRepository.findById(mandate.getPayerUserId())
                .orElseThrow(() -> new AppException("NOT_FOUND", "Payer not found", HttpStatus.NOT_FOUND));
        if (payer.getStatus() != User.AccountStatus.ACTIVE) {
            throw new AppException("ACCOUNT_INACTIVE", "Payer account is not active", HttpStatus.BAD_REQUEST);
        }

        Merchant merchant = merchantRepository.findByIdForUpdate(mandate.getMerchantId())
                .orElseThrow(() -> new AppException("NOT_FOUND", "Merchant not found", HttpStatus.NOT_FOUND));
        if (merchant.getStatus() != Merchant.MerchantStatus.ACTIVE) {
            throw new AppException("MERCHANT_INACTIVE", "Merchant is not accepting payments", HttpStatus.BAD_REQUEST);
        }

        Wallet payerWallet = walletRepository.findByUserIdForUpdate(mandate.getPayerUserId())
                .orElseThrow(() -> new AppException("NOT_FOUND", "Payer wallet not found", HttpStatus.NOT_FOUND));
        if (Boolean.TRUE.equals(payerWallet.getFrozen())) {
            throw new AppException("WALLET_FROZEN", "Payer's wallet has been frozen", HttpStatus.FORBIDDEN);
        }
        if (payerWallet.getBalance().compareTo(amount) < 0) {
            throw new AppException("INSUFFICIENT_FUNDS", "Payer has insufficient balance", HttpStatus.BAD_REQUEST);
        }

        // Same fee math as CheckoutService.confirmPayment's automatic-release path — a mandate
        // charge is a merchant payment that happens to skip the hosted checkout page.
        BigDecimal feeRate = BigDecimal.valueOf(merchant.getFeeRateBps())
                .divide(BigDecimal.valueOf(10_000), 6, RoundingMode.HALF_UP);
        BigDecimal platformFee = amount.multiply(feeRate).setScale(2, RoundingMode.HALF_UP);
        BigDecimal netAmount = amount.subtract(platformFee);

        payerWallet.setBalance(payerWallet.getBalance().subtract(amount));
        walletRepository.save(payerWallet);
        payer.setBalance(payerWallet.getBalance());
        userRepository.save(payer);

        merchant.setBalance(merchant.getBalance().add(netAmount));
        merchant.setTotalVolume(merchant.getTotalVolume().add(amount));
        merchantRepository.save(merchant);

        String note = (reference != null && !reference.isBlank()) ? reference : mandate.getReference();
        Transaction tx = Transaction.builder()
                .senderId(mandate.getPayerUserId())
                .recipientId(merchant.getUserId())
                .amount(amount)
                .feeAmount(platformFee)
                .note(note)
                .type(Transaction.TransactionType.MERCHANT_PAYMENT)
                .status(Transaction.TransactionStatus.COMPLETED)
                .idempotencyKey("mandate_charge:" + mandate.getId() + ":" + idempotencyKey)
                .completedAt(LocalDateTime.now())
                .build();
        transactionRepository.save(tx);

        mandate.setLastChargedAt(LocalDateTime.now());
        if (mandate.getPeriodLimit() != null) {
            mandate.setPeriodSpent(mandate.getPeriodSpent().add(amount));
        }
        mandateRepository.save(mandate);

        return chargeRepository.save(MandateCharge.builder()
                .mandateId(mandate.getId())
                .merchantId(mandate.getMerchantId())
                .amount(amount)
                .idempotencyKey(idempotencyKey)
                .status(MandateCharge.Status.COMPLETED)
                .transactionId(tx.getId())
                .build());
    }

    static LocalDateTime nextPeriodReset(LocalDateTime from, PaymentMandate.PeriodType type) {
        return switch (type) {
            case DAILY -> from.plusDays(1);
            case WEEKLY -> from.plusWeeks(1);
            case MONTHLY -> from.plusMonths(1);
        };
    }
}
