package com.aza.backend.service;

import com.aza.backend.dto.bill.BillPaymentResponse;
import com.aza.backend.dto.bill.PayBillRequest;
import com.aza.backend.entity.*;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.*;
import com.aza.backend.service.biller.BillerProvider;
import com.aza.backend.util.RateLimitService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;

/**
 * Paying a bill.
 *
 * This is the first money path in Aza where the money leaves the platform and the thing
 * that decides whether it arrived is a system Aza does not control. That single fact
 * dictates the shape of the code, and it is why the work is deliberately split across
 * three commits rather than done in one transaction:
 *
 * <ol>
 *   <li><b>Reserve</b> — debit the wallet and write the ledger row, then <em>commit</em>.
 *       The provider is never called with the money still in the customer's wallet, so a
 *       bill can never be paid without the debit having happened first.</li>
 *   <li><b>Send</b> — call the provider outside any transaction. A rollback here must not
 *       be able to undo a debit for a payment that actually went out.</li>
 *   <li><b>Settle</b> — record what happened, refunding only when the provider says it
 *       is not holding the money.</li>
 * </ol>
 *
 * Silence is not failure. A provider that times out has said nothing, and refunding on
 * nothing would hand back money the biller already took. Those payments stay PENDING and
 * are resolved by asking, which is what {@link #reconcile} is for.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class BillPaymentService {

    private final BillPaymentRepository billPaymentRepository;
    private final BillerRepository billerRepository;
    private final WalletRepository walletRepository;
    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    private final NotificationService notificationService;
    private final RateLimitService rateLimitService;
    private final UserService userService;
    private final LimitGuard limitGuard;
    private final BillerProvider provider;
    private final TransactionTemplate txTemplate;

    private static final ZoneId GHANA_TZ = ZoneId.of("Africa/Accra");
    /** How long to let a provider stay silent before asking what happened. */
    private static final Duration RECONCILE_AFTER = Duration.ofMinutes(5);
    private static final int MAX_RECONCILE_ATTEMPTS = 20;

    // ==================== CATALOGUE ====================

    @Transactional(readOnly = true)
    public List<Biller> billers(String category) {
        if (category == null || category.isBlank()) {
            return billerRepository.findAllByActiveTrueOrderByCategoryAscNameAsc();
        }
        try {
            return billerRepository.findAllByCategoryAndActiveTrueOrderByNameAsc(
                    Biller.Category.valueOf(category.trim().toUpperCase()));
        } catch (IllegalArgumentException e) {
            throw new AppException("UNKNOWN_CATEGORY", "No such biller category.", HttpStatus.BAD_REQUEST);
        }
    }

    /**
     * Ask the biller who an account belongs to, so the payer sees a name before they
     * commit. A mistyped meter number is not a payment that fails — it is a payment that
     * succeeds into a stranger's account, and this is the only thing that catches it.
     */
    @Transactional(readOnly = true)
    public BillerProvider.AccountLookup lookup(User user, String billerSlug, String accountNumber) {
        rateLimitService.enforceRateLimit("bill:lookup:" + user.getId(), 60, Duration.ofHours(1));
        Biller biller = activeBiller(billerSlug);
        validateAccountFormat(biller, accountNumber);
        if (!biller.isSupportsNameLookup()) return BillerProvider.AccountLookup.unsupported();
        return provider.lookup(biller, accountNumber.trim());
    }

    // ==================== PAY ====================

    /**
     * Not transactional on purpose. Each step below commits on its own, because the
     * provider call in the middle must not sit inside a transaction that could roll back
     * a debit for money that has already gone out.
     */
    public BillPaymentResponse pay(User user, PayBillRequest req) {
        Optional<BillPayment> replay =
                billPaymentRepository.findByUserIdAndIdempotencyKey(user.getId(), req.getIdempotencyKey());
        if (replay.isPresent()) {
            return toResponse(replay.get());
        }

        if (user.getStatus() != User.AccountStatus.ACTIVE) {
            throw new AppException("Your account is not active");
        }
        if (user.getKycStatus() != User.KycStatus.VERIFIED) {
            throw new AppException("KYC verification required before paying bills");
        }
        rateLimitService.enforceRateLimit("bill:pay:" + user.getId(), 30, Duration.ofHours(1));

        Biller biller = activeBiller(req.getBillerSlug());
        validateAccountFormat(biller, req.getAccountNumber());

        BigDecimal amount = req.getAmount().setScale(2, RoundingMode.HALF_UP);
        validateAmount(biller, amount);

        userService.verifyPasscode(user, req.getPasscode());
        limitGuard.enforceSingle(user, amount);
        enforceDailyLimit(user, amount);

        // ── 1. Reserve. Committed before anything leaves the building. ──
        BillPayment payment = txTemplate.execute(status -> reserve(user, biller, req, amount));
        if (payment == null) throw new AppException("Could not start this payment");

        // ── 2. Send. Outside any transaction. ──
        BillerProvider.PaymentResult result;
        try {
            result = provider.pay(payment, biller);
        } catch (AppException e) {
            // A clean refusal means the provider never sent it, so the money is ours to
            // give back — a customer must not be left short because a biller was down.
            txTemplate.executeWithoutResult(s -> refund(payment.getId(), e.getMessage()));
            throw e;
        } catch (Exception e) {
            // Anything else and we do not know what happened. Leaving it PENDING is the
            // whole point: the sweep will ask rather than guess.
            log.error("Bill provider gave no answer, leaving payment pending: payment={}, biller={}",
                    payment.getId(), biller.getSlug(), e);
            return toResponse(payment);
        }

        // ── 3. Settle. ──
        BillPayment settled = txTemplate.execute(s -> applyResult(payment.getId(), result));
        return toResponse(settled != null ? settled : payment);
    }

    /**
     * Take the money and write it down. The wallet row is locked, so two payments racing
     * on the same balance are serialised rather than both seeing enough funds.
     */
    BillPayment reserve(User user, Biller biller, PayBillRequest req, BigDecimal amount) {
        Wallet wallet = walletRepository.findByUserIdForUpdate(user.getId())
                .orElseThrow(() -> new AppException("NO_WALLET", "Wallet not found", HttpStatus.NOT_FOUND));
        if (Boolean.TRUE.equals(wallet.getFrozen())) {
            throw new AppException("WALLET_FROZEN",
                    "Your wallet has been frozen. Please contact support.", HttpStatus.FORBIDDEN);
        }
        if (wallet.getBalance().compareTo(amount) < 0) {
            throw new AppException("INSUFFICIENT_FUNDS", "Insufficient balance", HttpStatus.BAD_REQUEST);
        }

        wallet.setBalance(wallet.getBalance().subtract(amount));
        walletRepository.save(wallet);
        user.setBalance(wallet.getBalance());
        userRepository.save(user);

        BillPayment payment = billPaymentRepository.save(BillPayment.builder()
                .userId(user.getId())
                .billerId(biller.getId())
                .accountNumber(req.getAccountNumber().trim())
                .accountName(blankToNull(req.getAccountName()))
                .amount(amount)
                .status(BillPayment.Status.PENDING)
                .idempotencyKey(req.getIdempotencyKey())
                .build());

        // The debit is on the ledger from the moment it happens, pending until the
        // biller confirms — a wallet must never drop with nothing to explain it.
        Transaction ledger = transactionRepository.save(Transaction.builder()
                .senderId(user.getId())
                .recipientId(user.getId())
                .recipientType(Transaction.RecipientType.USER)
                .amount(amount)
                .note(biller.getName() + " · " + req.getAccountNumber().trim())
                .type(Transaction.TransactionType.BILL_PAY)
                .status(Transaction.TransactionStatus.PENDING)
                .idempotencyKey("bill:" + payment.getId())
                .build());

        payment.setTransactionId(ledger.getId());
        return billPaymentRepository.save(payment);
    }

    /** Record what the provider said. Only a definite refusal gives money back. */
    BillPayment applyResult(UUID paymentId, BillerProvider.PaymentResult result) {
        BillPayment payment = billPaymentRepository.findByIdForUpdate(paymentId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Payment not found", HttpStatus.NOT_FOUND));
        if (payment.getStatus() != BillPayment.Status.PENDING) return payment;

        payment.setProviderReference(result.providerReference());

        switch (result.outcome()) {
            case SUCCESS -> {
                payment.setStatus(BillPayment.Status.COMPLETED);
                payment.setToken(result.token());
                payment.setCompletedAt(LocalDateTime.now());
                completeLedger(payment, Transaction.TransactionStatus.COMPLETED);
                notificationService.sendNotification(
                        payment.getUserId(),
                        Notification.NotificationType.TRANSFER_COMPLETED,
                        "Bill paid",
                        billerName(payment) + " paid — GHS " + payment.getAmount().toPlainString()
                                + (result.token() != null ? ". Token: " + result.token() : "."),
                        null, payment.getAmount());
                log.info("Bill paid: payment={}, ref={}", payment.getId(), result.providerReference());
            }
            case REJECTED -> {
                refundInto(payment, result.failureReason());
            }
            case UNKNOWN -> {
                // Deliberately nothing. It stays pending and the sweep asks again.
                log.warn("Bill payment outcome still unknown: payment={}", payment.getId());
            }
        }
        return billPaymentRepository.save(payment);
    }

    /** Give the money back for a payment that definitely never went out. */
    BillPayment refund(UUID paymentId, String reason) {
        BillPayment payment = billPaymentRepository.findByIdForUpdate(paymentId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Payment not found", HttpStatus.NOT_FOUND));
        if (payment.getStatus() != BillPayment.Status.PENDING) return payment;
        refundInto(payment, reason);
        return billPaymentRepository.save(payment);
    }

    private void refundInto(BillPayment payment, String reason) {
        Wallet wallet = walletRepository.findByUserIdForUpdate(payment.getUserId()).orElse(null);
        if (wallet == null) {
            // Leave it pending rather than call money settled when it went nowhere.
            log.error("Bill refund failed — wallet missing: payment={}, user={}",
                    payment.getId(), payment.getUserId());
            throw new AppException("NO_WALLET", "Wallet not found", HttpStatus.NOT_FOUND);
        }
        wallet.setBalance(wallet.getBalance().add(payment.getAmount()));
        walletRepository.save(wallet);
        userRepository.findById(payment.getUserId()).ifPresent(u -> {
            u.setBalance(wallet.getBalance());
            userRepository.save(u);
        });

        payment.setStatus(BillPayment.Status.REFUNDED);
        payment.setFailureReason(reason);
        payment.setRefundedAt(LocalDateTime.now());
        completeLedger(payment, Transaction.TransactionStatus.CANCELLED);

        notificationService.sendNotification(
                payment.getUserId(),
                Notification.NotificationType.MONEY_RECEIVED,
                "Bill payment refunded",
                billerName(payment) + " couldn't be paid, so GHS "
                        + payment.getAmount().toPlainString() + " is back in your wallet.",
                null, payment.getAmount());

        log.info("Bill payment refunded: payment={}, reason={}", payment.getId(), reason);
    }

    /** Move the ledger row to its final state rather than adding an opposite one. */
    private void completeLedger(BillPayment payment, Transaction.TransactionStatus status) {
        if (payment.getTransactionId() == null) return;
        transactionRepository.findById(payment.getTransactionId()).ifPresent(t -> {
            t.setStatus(status);
            if (status == Transaction.TransactionStatus.COMPLETED) {
                t.setCompletedAt(LocalDateTime.now());
            } else {
                t.setCancelledAt(LocalDateTime.now());
            }
            transactionRepository.save(t);
        });
    }

    // ==================== RECONCILIATION ====================

    /**
     * Ask what became of payments the provider never answered for.
     *
     * Each one is settled in its own transaction so a provider that fails on one payment
     * does not roll back the answers already collected for the others.
     */
    public int reconcile() {
        List<BillPayment> stuck = billPaymentRepository.findStuckPending(
                LocalDateTime.now().minus(RECONCILE_AFTER));
        int settled = 0;

        for (BillPayment payment : stuck) {
            if (payment.getReconcileAttempts() >= MAX_RECONCILE_ATTEMPTS) {
                // Past this it is not a transient failure. A person has to look at it,
                // and a customer is owed an answer either way.
                txTemplate.executeWithoutResult(s -> markForReview(payment.getId()));
                continue;
            }
            try {
                BillerProvider.PaymentResult result = provider.status(payment.getProviderReference());
                BillPayment after = txTemplate.execute(s -> {
                    bumpAttempts(payment.getId());
                    return applyResult(payment.getId(), result);
                });
                if (after != null && after.getStatus() != BillPayment.Status.PENDING) settled++;
            } catch (Exception e) {
                log.error("Could not reconcile bill payment {}", payment.getId(), e);
            }
        }
        if (!stuck.isEmpty()) {
            log.info("Bill reconciliation: {} of {} pending payments settled", settled, stuck.size());
        }
        return settled;
    }

    void bumpAttempts(UUID paymentId) {
        billPaymentRepository.findById(paymentId).ifPresent(p -> {
            p.setReconcileAttempts(p.getReconcileAttempts() + 1);
            billPaymentRepository.save(p);
        });
    }

    void markForReview(UUID paymentId) {
        billPaymentRepository.findByIdForUpdate(paymentId).ifPresent(p -> {
            if (p.getStatus() != BillPayment.Status.PENDING) return;
            p.setStatus(BillPayment.Status.FAILED);
            p.setFailureReason("No outcome from provider after " + MAX_RECONCILE_ATTEMPTS + " attempts");
            billPaymentRepository.save(p);
            // Not refunded: the provider may be holding the money. Deciding that is a
            // person's job, and pretending otherwise risks paying the bill twice.
            log.error("Bill payment needs manual settlement: payment={}, user={}, amount={}",
                    p.getId(), p.getUserId(), p.getAmount());
        });
    }

    // ==================== QUERIES ====================

    @Transactional(readOnly = true)
    public Page<BillPaymentResponse> history(UUID userId, int page, int size) {
        return billPaymentRepository
                .findAllByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(page, Math.min(size, 50)))
                .map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public BillPaymentResponse get(User user, UUID id) {
        BillPayment payment = billPaymentRepository.findById(id)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Payment not found", HttpStatus.NOT_FOUND));
        if (!payment.getUserId().equals(user.getId())) {
            throw new AppException("FORBIDDEN", "That isn't your payment.", HttpStatus.FORBIDDEN);
        }
        return toResponse(payment);
    }

    // ==================== VALIDATION ====================

    private Biller activeBiller(String slug) {
        Biller biller = billerRepository.findBySlug(slug == null ? "" : slug.trim())
                .orElseThrow(() -> new AppException("UNKNOWN_BILLER", "No such biller.", HttpStatus.NOT_FOUND));
        if (!biller.isActive()) {
            throw new AppException("BILLER_INACTIVE",
                    biller.getName() + " isn't available right now.", HttpStatus.SERVICE_UNAVAILABLE);
        }
        return biller;
    }

    private void validateAccountFormat(Biller biller, String accountNumber) {
        String account = accountNumber == null ? "" : accountNumber.trim();
        if (account.isEmpty()) {
            throw new AppException("ACCOUNT_REQUIRED",
                    biller.getAccountLabel() + " is required.", HttpStatus.BAD_REQUEST);
        }
        if (biller.getAccountPattern() == null || biller.getAccountPattern().isBlank()) return;
        try {
            if (!Pattern.matches(biller.getAccountPattern(), account)) {
                throw new AppException("ACCOUNT_INVALID",
                        "That doesn't look like a valid " + biller.getAccountLabel().toLowerCase() + ".",
                        HttpStatus.BAD_REQUEST);
            }
        } catch (PatternSyntaxException e) {
            // A broken pattern in the catalogue must not become a way to pay unchecked.
            log.error("Biller {} has an invalid account pattern", biller.getSlug(), e);
            throw new AppException("BILLER_MISCONFIGURED",
                    biller.getName() + " isn't available right now.", HttpStatus.SERVICE_UNAVAILABLE);
        }
    }

    private void validateAmount(Biller biller, BigDecimal amount) {
        if (amount.compareTo(biller.getMinAmount()) < 0) {
            throw new AppException("AMOUNT_TOO_SMALL",
                    biller.getName() + " takes at least GHS " + biller.getMinAmount().toPlainString() + ".",
                    HttpStatus.BAD_REQUEST);
        }
        if (biller.getMaxAmount() != null && amount.compareTo(biller.getMaxAmount()) > 0) {
            throw new AppException("AMOUNT_TOO_LARGE",
                    biller.getName() + " takes at most GHS " + biller.getMaxAmount().toPlainString() + ".",
                    HttpStatus.BAD_REQUEST);
        }
    }

    private void enforceDailyLimit(User user, BigDecimal amount) {
        LocalDateTime startOfDay = LocalDate.now(GHANA_TZ).atStartOfDay();
        LocalDateTime endOfDay = startOfDay.plusDays(1);
        BigDecimal sentToday = transactionRepository.getTotalSentToday(
                user.getId(), startOfDay, endOfDay, LocalDateTime.now(GHANA_TZ));

        BigDecimal dailyLimit = limitGuard.dailyLimit(user);
        if (sentToday.add(amount).compareTo(dailyLimit) > 0) {
            BigDecimal remaining = dailyLimit.subtract(sentToday).max(BigDecimal.ZERO);
            throw new AppException("LIMIT_EXCEEDED",
                    "This would exceed your daily limit. Remaining today: GHS " + remaining.toPlainString(),
                    HttpStatus.BAD_REQUEST);
        }
    }

    // ==================== MAPPING ====================

    BillPaymentResponse toResponse(BillPayment payment) {
        Biller biller = billerRepository.findById(payment.getBillerId()).orElse(null);
        return BillPaymentResponse.builder()
                .id(payment.getId().toString())
                .billerSlug(biller != null ? biller.getSlug() : null)
                .billerName(biller != null ? biller.getName() : "Biller")
                .billerLogoUrl(biller != null ? biller.getLogoUrl() : null)
                .accountNumber(payment.getAccountNumber())
                .accountName(payment.getAccountName())
                .amount(payment.getAmount())
                .currency(payment.getCurrency())
                .status(payment.getStatus().name())
                .token(payment.getToken())
                .providerReference(payment.getProviderReference())
                .failureReason(payment.getFailureReason())
                .createdAt(payment.getCreatedAt())
                .completedAt(payment.getCompletedAt())
                .build();
    }

    private String billerName(BillPayment payment) {
        return billerRepository.findById(payment.getBillerId()).map(Biller::getName).orElse("Your bill");
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
