package com.aza.backend.service;

import com.aza.backend.dto.admin.AdminStatsResponse;
import com.aza.backend.dto.admin.AdminTransactionResponse;
import com.aza.backend.dto.admin.AdminUserResponse;
import com.aza.backend.dto.admin.AdminWalletResponse;
import com.aza.backend.dto.admin.KycAnalyticsResponse;
import com.aza.backend.dto.admin.LiveStatsResponse;
import com.aza.backend.entity.KycRecord;
import com.aza.backend.entity.Merchant;
import com.aza.backend.entity.Transaction;
import com.aza.backend.entity.User;
import com.aza.backend.entity.Wallet;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.KycRecordRepository;
import com.aza.backend.repository.MerchantRepository;
import com.aza.backend.repository.TransactionRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.repository.WalletRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AdminService {

    private final UserRepository userRepository;
    private final WalletRepository walletRepository;
    private final WalletLedger walletLedger;
    private final WalletLocker walletLocker;
    private final TransactionRepository transactionRepository;
    private final KycRecordRepository kycRecordRepository;
    private final MerchantRepository merchantRepository;
    private final PresenceService presenceService;
    private final AdminAuditService auditService;
    private final NotificationService notificationService;

    public Page<AdminUserResponse> getUsers(String query, String status, String kycStatus,
                                            boolean onlineOnly, int page, int size) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());

        Page<User> users;
        if (onlineOnly) {
            // DB mirror is kept honest by the presence sweeper (≤30s lag).
            users = userRepository.findAllByOnlineStatus(User.OnlineStatus.ONLINE, pageable);
        } else if (query != null && !query.isBlank()) {
            users = userRepository.adminSearchUsers(query, pageable);
        } else if (status != null && !status.isBlank()) {
            User.AccountStatus accountStatus = User.AccountStatus.valueOf(status.toUpperCase());
            users = userRepository.findAllByStatus(accountStatus, pageable);
        } else if (kycStatus != null && !kycStatus.isBlank()) {
            User.KycStatus userKycStatus = User.KycStatus.valueOf(kycStatus.toUpperCase());
            users = userRepository.findAllByKycStatus(userKycStatus, pageable);
        } else {
            users = userRepository.findAll(pageable);
        }

        return users.map(this::toAdminUserResponse);
    }

    public AdminUserResponse getUserDetail(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException("USER_NOT_FOUND", "User not found", HttpStatus.NOT_FOUND));
        return toAdminUserResponse(user);
    }

    @Transactional
    public AdminUserResponse updateUserStatus(UUID userId, String newStatus, String reason) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException("USER_NOT_FOUND", "User not found", HttpStatus.NOT_FOUND));

        User.AccountStatus accountStatus = User.AccountStatus.valueOf(newStatus.toUpperCase());
        user.setStatus(accountStatus);
        if (reason != null && !reason.isBlank()) {
            user.setDeactivationReason(reason);
        }
        userRepository.save(user);
        return toAdminUserResponse(user);
    }

    private AdminTransactionResponse toAdminTransactionResponse(Transaction tx) {
        User sender = userRepository.findById(tx.getSenderId()).orElse(null);
        // A merchant recipient is a merchants row, not a users row; looking it up as
        // a user is what made every store sale read as "Unknown" in the admin views.
        boolean toMerchant = tx.getRecipientType() == Transaction.RecipientType.MERCHANT;
        User recipient = toMerchant ? null : userRepository.findById(tx.getRecipientId()).orElse(null);
        Merchant recipientMerchant = toMerchant
                ? merchantRepository.findById(tx.getRecipientId()).orElse(null) : null;
        return AdminTransactionResponse.builder()
                .id(tx.getId().toString())
                .senderId(tx.getSenderId().toString())
                .senderName(sender != null ? sender.getFirstName() + " " + sender.getLastName() : "Unknown")
                .senderHandle(sender != null ? sender.getUsername() : null)
                .recipientId(tx.getRecipientId().toString())
                .recipientName(recipientMerchant != null ? recipientMerchant.getBusinessName()
                        : recipient != null ? recipient.getFirstName() + " " + recipient.getLastName() : "Unknown")
                .recipientHandle(recipientMerchant != null ? recipientMerchant.getBusinessHandle()
                        : recipient != null ? recipient.getUsername() : null)
                .amount(tx.getAmount())
                .note(tx.getNote())
                .type(tx.getType().name())
                .status(tx.getStatus().name())
                .initiatedAt(tx.getInitiatedAt())
                .completedAt(tx.getCompletedAt())
                .cancelledAt(tx.getCancelledAt())
                .category(tx.getCategory() != null ? tx.getCategory().name() : null)
                .anomalyScore(tx.getAnomalyScore())
                .anomalyRiskLevel(tx.getAnomalyRiskLevel())
                .initiationLocation(tx.getInitiationLocation())
                .build();
    }

    public Page<AdminTransactionResponse> getTransactions(int page, int size) {
        PageRequest pageable = PageRequest.of(page, size);
        return transactionRepository.findAllOrderByInitiatedAtDesc(pageable)
                .map(this::toAdminTransactionResponse);
    }

    public Page<AdminTransactionResponse> searchTransactions(
            String query, String status, String type, String from, String to, int page, int size) {
        Transaction.TransactionStatus txStatus = (status != null && !status.isBlank())
                ? Transaction.TransactionStatus.valueOf(status.toUpperCase()) : null;
        Transaction.TransactionType txType = (type != null && !type.isBlank())
                ? Transaction.TransactionType.valueOf(type.toUpperCase()) : null;
        LocalDateTime fromDt = (from != null && !from.isBlank()) ? LocalDate.parse(from).atStartOfDay() : null;
        LocalDateTime toDt = (to != null && !to.isBlank()) ? LocalDate.parse(to).atTime(23, 59, 59) : null;
        PageRequest pageable = PageRequest.of(page, size);

        if (query != null && !query.isBlank()) {
            List<UUID> userIds = userRepository.adminSearchUsers(query, PageRequest.of(0, 100))
                    .stream().map(User::getId).toList();
            if (userIds.isEmpty()) return org.springframework.data.domain.Page.empty(pageable);
            return transactionRepository.adminSearchByUserIds(userIds, txStatus, txType, fromDt, toDt, pageable)
                    .map(this::toAdminTransactionResponse);
        }
        return transactionRepository.adminSearch(txStatus, txType, fromDt, toDt, pageable)
                .map(this::toAdminTransactionResponse);
    }

    public List<AdminTransactionResponse> exportTransactions(
            String status, String type, String from, String to) {
        Transaction.TransactionStatus txStatus = (status != null && !status.isBlank())
                ? Transaction.TransactionStatus.valueOf(status.toUpperCase()) : null;
        Transaction.TransactionType txType = (type != null && !type.isBlank())
                ? Transaction.TransactionType.valueOf(type.toUpperCase()) : null;
        LocalDateTime fromDt = (from != null && !from.isBlank()) ? LocalDate.parse(from).atStartOfDay() : null;
        LocalDateTime toDt = (to != null && !to.isBlank()) ? LocalDate.parse(to).atTime(23, 59, 59) : null;
        return transactionRepository.adminSearchAll(txStatus, txType, fromDt, toDt)
                .stream().map(this::toAdminTransactionResponse).toList();
    }

    public Page<AdminTransactionResponse> getUserTransactions(UUID userId, int page, int size) {
        PageRequest pageable = PageRequest.of(page, size);
        return transactionRepository.findAllByUserId(userId, pageable).map(this::toAdminTransactionResponse);
    }

    public AdminStatsResponse getStats() {
        long totalUsers = userRepository.count();
        long activeUsers = userRepository.countByStatus(User.AccountStatus.ACTIVE);
        long suspendedUsers = userRepository.countByStatus(User.AccountStatus.SUSPENDED);
        long deactivatedUsers = userRepository.countByStatus(User.AccountStatus.DEACTIVATED);

        long kycVerified = userRepository.countByKycStatus(User.KycStatus.VERIFIED);
        long kycPendingReview = userRepository.countByKycStatus(User.KycStatus.UNDER_REVIEW);
        long kycRejected = userRepository.countByKycStatus(User.KycStatus.REJECTED);
        long kycNotStarted = userRepository.countByKycStatus(User.KycStatus.NOT_STARTED);

        long totalTransactions = transactionRepository.count();
        long completedTransactions = transactionRepository.countByStatus(Transaction.TransactionStatus.COMPLETED);
        BigDecimal totalVolume = transactionRepository.sumCompletedVolume();

        LocalDateTime startOfDay = LocalDate.now(ZoneId.of("Africa/Accra")).atStartOfDay();
        LocalDateTime endOfDay = startOfDay.plusDays(1);
        long transactionsToday = transactionRepository.countByInitiatedAtBetween(startOfDay, endOfDay);
        BigDecimal volumeToday = transactionRepository.sumVolumeByInitiatedAtBetween(startOfDay, endOfDay);

        long totalMerchants = merchantRepository.count();
        long activeMerchants = merchantRepository.countByStatus(Merchant.MerchantStatus.ACTIVE);
        long pendingKybMerchants = merchantRepository.countByStatus(Merchant.MerchantStatus.KYB_UNDER_REVIEW)
                + merchantRepository.countByStatus(Merchant.MerchantStatus.KYB_SUBMITTED);
        BigDecimal totalMerchantVolume = merchantRepository.sumActiveMerchantVolume();
        BigDecimal totalWalletBalance = walletRepository.sumTotalBalance();
        BigDecimal totalMerchantBalance = merchantRepository.sumTotalMerchantBalance();

        return AdminStatsResponse.builder()
                .totalUsers(totalUsers)
                .activeUsers(activeUsers)
                .suspendedUsers(suspendedUsers)
                .deactivatedUsers(deactivatedUsers)
                .kycVerified(kycVerified)
                .kycPendingReview(kycPendingReview)
                .kycRejected(kycRejected)
                .kycNotStarted(kycNotStarted)
                .totalTransactions(totalTransactions)
                .completedTransactions(completedTransactions)
                .totalTransactionVolume(totalVolume != null ? totalVolume : BigDecimal.ZERO)
                .transactionsToday(transactionsToday)
                .volumeToday(volumeToday != null ? volumeToday : BigDecimal.ZERO)
                .totalMerchants(totalMerchants)
                .activeMerchants(activeMerchants)
                .pendingKybMerchants(pendingKybMerchants)
                .totalMerchantVolume(totalMerchantVolume != null ? totalMerchantVolume : BigDecimal.ZERO)
                .totalWalletBalance(totalWalletBalance != null ? totalWalletBalance : BigDecimal.ZERO)
                .totalMerchantBalance(totalMerchantBalance != null ? totalMerchantBalance : BigDecimal.ZERO)
                .build();
    }

    public LiveStatsResponse getLiveStats() {
        long onlineUsers = presenceService.countOnlineUsers();
        long transactionsLastHour = transactionRepository.countByInitiatedAtAfter(LocalDateTime.now().minusHours(1));
        long pendingKyc = userRepository.countByKycStatus(User.KycStatus.UNDER_REVIEW);
        return LiveStatsResponse.builder()
                .onlineUsers(onlineUsers)
                .transactionsLastHour(transactionsLastHour)
                .pendingKycCount(pendingKyc)
                .build();
    }

    // ==================== WALLET MANAGEMENT ====================

    public Page<AdminWalletResponse> getWallets(int page, int size) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by("lastUpdatedAt").descending());
        return walletRepository.findAll(pageable).map(wallet -> {
            User user = userRepository.findById(wallet.getUserId()).orElse(null);
            return AdminWalletResponse.builder()
                    .walletId(wallet.getId().toString())
                    .userId(wallet.getUserId().toString())
                    .userName(user != null ? user.getFirstName() + " " + user.getLastName() : "Unknown")
                    .userHandle(user != null ? user.getUsername() : null)
                    .userEmail(user != null ? user.getEmail() : null)
                    .balance(wallet.getBalance())
                    .currency(wallet.getCurrency())
                    .frozen(wallet.getFrozen())
                    .lastUpdatedAt(wallet.getLastUpdatedAt())
                    .build();
        });
    }

    @Transactional
    public AdminWalletResponse freezeWallet(UUID userId, boolean freeze) {
        Wallet wallet = walletRepository.findByUserId(userId)
                .orElseThrow(() -> new AppException("WALLET_NOT_FOUND", "Wallet not found for user", HttpStatus.NOT_FOUND));
        wallet.setFrozen(freeze);
        walletRepository.save(wallet);

        User user = userRepository.findById(userId).orElse(null);
        return AdminWalletResponse.builder()
                .walletId(wallet.getId().toString())
                .userId(wallet.getUserId().toString())
                .userName(user != null ? user.getFirstName() + " " + user.getLastName() : "Unknown")
                .userHandle(user != null ? user.getUsername() : null)
                .userEmail(user != null ? user.getEmail() : null)
                .balance(wallet.getBalance())
                .currency(wallet.getCurrency())
                .frozen(wallet.getFrozen())
                .lastUpdatedAt(wallet.getLastUpdatedAt())
                .build();
    }

    // ==================== KYC ANALYTICS ====================

    public KycAnalyticsResponse getKycAnalytics() {
        long notStarted = userRepository.countByKycStatus(User.KycStatus.NOT_STARTED);
        long pending = userRepository.countByKycStatus(User.KycStatus.PENDING);
        long underReview = userRepository.countByKycStatus(User.KycStatus.UNDER_REVIEW);
        long verified = userRepository.countByKycStatus(User.KycStatus.VERIFIED);
        long rejected = userRepository.countByKycStatus(User.KycStatus.REJECTED);

        LocalDateTime thirtyDaysAgo = LocalDateTime.now().minusDays(30);

        long approvedLast30Days = kycRecordRepository.countByStatusAndVerifiedAtAfter(
                KycRecord.KycStatus.VERIFIED, thirtyDaysAgo);
        long rejectedLast30Days = kycRecordRepository.countByStatusAndSubmittedAtAfter(
                KycRecord.KycStatus.REJECTED, thirtyDaysAgo);
        long submittedLast30Days = kycRecordRepository.countBySubmittedAtAfter(thirtyDaysAgo);

        double approvalRate = (verified + rejected) > 0
                ? (double) verified / (verified + rejected) * 100.0
                : 0.0;

        return KycAnalyticsResponse.builder()
                .notStarted(notStarted)
                .pending(pending)
                .underReview(underReview)
                .verified(verified)
                .rejected(rejected)
                .approvedLast30Days(approvedLast30Days)
                .rejectedLast30Days(rejectedLast30Days)
                .submittedLast30Days(submittedLast30Days)
                .approvalRate(Math.round(approvalRate * 100.0) / 100.0)
                .build();
    }

    // ==================== TRANSACTION DETAIL ====================

    public AdminTransactionResponse getTransactionById(UUID id) {
        Transaction tx = transactionRepository.findById(id)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Transaction not found", HttpStatus.NOT_FOUND));
        User sender = userRepository.findById(tx.getSenderId()).orElse(null);
        // A merchant recipient is a merchants row, not a users row; looking it up as
        // a user is what made every store sale read as "Unknown" in the admin views.
        boolean toMerchant = tx.getRecipientType() == Transaction.RecipientType.MERCHANT;
        User recipient = toMerchant ? null : userRepository.findById(tx.getRecipientId()).orElse(null);
        Merchant recipientMerchant = toMerchant
                ? merchantRepository.findById(tx.getRecipientId()).orElse(null) : null;
        return AdminTransactionResponse.builder()
                .id(tx.getId().toString())
                .senderId(tx.getSenderId().toString())
                .senderName(sender != null ? sender.getFirstName() + " " + sender.getLastName() : "Unknown")
                .senderHandle(sender != null ? sender.getUsername() : null)
                .recipientId(tx.getRecipientId().toString())
                .recipientName(recipientMerchant != null ? recipientMerchant.getBusinessName()
                        : recipient != null ? recipient.getFirstName() + " " + recipient.getLastName() : "Unknown")
                .recipientHandle(recipientMerchant != null ? recipientMerchant.getBusinessHandle()
                        : recipient != null ? recipient.getUsername() : null)
                .amount(tx.getAmount())
                .note(tx.getNote())
                .type(tx.getType().name())
                .status(tx.getStatus().name())
                .initiatedAt(tx.getInitiatedAt())
                .completedAt(tx.getCompletedAt())
                .cancelledAt(tx.getCancelledAt())
                .initiationLocation(tx.getInitiationLocation())
                .build();
    }

    @Transactional
    public AdminTransactionResponse reverseTransaction(UUID transactionId, User admin) {
        // Locked, not a plain read. The COMPLETED check below is a read-modify-write on
        // this row: two approvals raised against the same transaction would otherwise
        // both read COMPLETED and both refund it.
        Transaction tx = transactionRepository.findByIdForUpdate(transactionId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Transaction not found", HttpStatus.NOT_FOUND));

        if (tx.getStatus() != Transaction.TransactionStatus.COMPLETED) {
            throw new AppException("INVALID_STATE", "Only COMPLETED transactions can be reversed", HttpStatus.BAD_REQUEST);
        }

        // recipientId points at either a users row or a merchants row -- read it with
        // recipientType, never by assuming. Treating a merchant payment as a user
        // transfer looks for a wallet under the merchant's id, finds none, and fails
        // every attempt to reverse a store sale.
        if (tx.getRecipientType() == Transaction.RecipientType.MERCHANT) {
            reverseMerchantPayment(tx);
        } else {
            reverseUserTransfer(tx);
        }

        tx.setStatus(Transaction.TransactionStatus.REVERSED);
        tx.setCancelledAt(LocalDateTime.now());
        transactionRepository.save(tx);

        // Log the action
        User targetUser = userRepository.findById(tx.getSenderId()).orElse(null);
        auditService.log(admin, "REVERSE_TRANSACTION",
                targetUser,
                "transactionId=" + transactionId + " amount=" + tx.getAmount());

        User sender = userRepository.findById(tx.getSenderId()).orElse(null);
        // A merchant recipient is a merchants row, not a users row; looking it up as
        // a user is what made every store sale read as "Unknown" in the admin views.
        boolean toMerchant = tx.getRecipientType() == Transaction.RecipientType.MERCHANT;
        User recipient = toMerchant ? null : userRepository.findById(tx.getRecipientId()).orElse(null);
        Merchant recipientMerchant = toMerchant
                ? merchantRepository.findById(tx.getRecipientId()).orElse(null) : null;
        return AdminTransactionResponse.builder()
                .id(tx.getId().toString())
                .senderId(tx.getSenderId().toString())
                .senderName(sender != null ? sender.getFirstName() + " " + sender.getLastName() : "Unknown")
                .senderHandle(sender != null ? sender.getUsername() : null)
                .recipientId(tx.getRecipientId().toString())
                .recipientName(recipientMerchant != null ? recipientMerchant.getBusinessName()
                        : recipient != null ? recipient.getFirstName() + " " + recipient.getLastName() : "Unknown")
                .recipientHandle(recipientMerchant != null ? recipientMerchant.getBusinessHandle()
                        : recipient != null ? recipient.getUsername() : null)
                .amount(tx.getAmount())
                .note(tx.getNote())
                .type(tx.getType().name())
                .status(tx.getStatus().name())
                .initiatedAt(tx.getInitiatedAt())
                .completedAt(tx.getCompletedAt())
                .cancelledAt(tx.getCancelledAt())
                .initiationLocation(tx.getInitiationLocation())
                .build();
    }

    /** Wallet-to-wallet reversal: debit the recipient, make the sender whole. */
    private void reverseUserTransfer(Transaction tx) {
        // Both wallets locked in canonical order, so the funds check happens under the
        // lock rather than against a stale read.
        WalletLocker.Locked reversal = walletLocker.lock(
                WalletLocker.personal(tx.getRecipientId(), "Recipient wallet not found"),
                WalletLocker.personal(tx.getSenderId(), "Sender wallet not found"));
        Wallet recipientWallet = reversal.first();
        Wallet senderWallet = reversal.second();

        if (recipientWallet.getBalance().compareTo(tx.getAmount()) < 0) {
            throw new AppException("INSUFFICIENT_FUNDS",
                    "Recipient has insufficient funds for reversal", HttpStatus.BAD_REQUEST);
        }
        walletLedger.transferLocked(recipientWallet, senderWallet, tx.getAmount(), BigDecimal.ZERO, null);
    }

    /**
     * Store-sale reversal: claw back what the merchant actually banked and refund the
     * customer in full.
     *
     * <p>The two are not the same number. The merchant was credited the amount net of
     * AZA's MDR, so that net is all there is to take back -- but the customer paid the
     * gross, and a reversal that kept the fee would be AZA charging for a sale that no
     * longer exists. The difference is AZA giving back its own fee, which is the same
     * rule {@code CheckoutService} applies when it refunds a session.
     *
     * <p>The fee comes off the transaction row rather than being recomputed from the
     * merchant's current rate, so a rate change between the sale and the reversal cannot
     * shift the amount. Rows written before the fee was recorded fall back to zero, which
     * claws back the gross -- the merchant keeps nothing they were not paid, and the
     * customer is made whole either way.
     */
    private void reverseMerchantPayment(Transaction tx) {
        // Merchant first, then wallet -- the same lock order as every other path that
        // touches both (MerchantService.requestPayout, ConnectService, CheckoutService).
        Merchant merchant = merchantRepository.findByIdForUpdate(tx.getRecipientId())
                .orElseThrow(() -> new AppException("MERCHANT_NOT_FOUND",
                        "Merchant not found for this payment", HttpStatus.NOT_FOUND));

        BigDecimal fee = tx.getFeeAmount() != null ? tx.getFeeAmount() : BigDecimal.ZERO;
        BigDecimal merchantReceived = tx.getAmount().subtract(fee);
        if (merchantReceived.signum() < 0) merchantReceived = BigDecimal.ZERO;

        if (merchant.getBalance().compareTo(merchantReceived) < 0) {
            throw new AppException("INSUFFICIENT_FUNDS",
                    "Merchant has already paid out this sale and cannot be auto-reversed ("
                            + merchant.getCurrency() + " " + merchantReceived.toPlainString()
                            + " needed). Reverse it manually.", HttpStatus.BAD_REQUEST);
        }

        merchant.setBalance(merchant.getBalance().subtract(merchantReceived));
        merchantRepository.save(merchant);

        walletLedger.credit(
                WalletLocker.personal(tx.getSenderId(), "Sender wallet not found"),
                tx.getAmount());
    }

    /**
     * Moves funds out of the requesting admin's own wallet into a recipient's, on approval.
     * Runs as the maker-checker's execution step (ApprovalService.ADMIN_FUND_TRANSFER) — the
     * requester (not the approver) is the sender, since the approver is only authorizing someone
     * else's already-submitted request. The idempotency key ties the resulting transaction to the
     * approval row: transactions.idempotency_key is globally unique, so a concurrent double-approval
     * would fail the second insert and roll back rather than moving the money twice.
     */
    @Transactional
    public void transferFunds(UUID approvalId, UUID requesterId, UUID recipientId,
                               BigDecimal amount, String reference, User approver) {
        if (requesterId.equals(recipientId)) {
            throw new AppException("SELF_TRANSFER", "Cannot transfer to yourself", HttpStatus.BAD_REQUEST);
        }

        User requester = userRepository.findById(requesterId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Requesting admin not found", HttpStatus.NOT_FOUND));
        User recipient = userRepository.findById(recipientId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Recipient not found", HttpStatus.NOT_FOUND));
        if (recipient.getStatus() != User.AccountStatus.ACTIVE) {
            throw new AppException("RECIPIENT_INACTIVE", "Recipient account is not active", HttpStatus.BAD_REQUEST);
        }

        // Lock both wallets in a fixed order (by user id) regardless of sender/recipient role,
        // so two concurrent admin transfers between the same pair of accounts can never deadlock.
        UUID first = requesterId.compareTo(recipientId) <= 0 ? requesterId : recipientId;
        UUID second = requesterId.compareTo(recipientId) <= 0 ? recipientId : requesterId;
        Wallet firstWallet = walletRepository.findByUserIdForUpdate(first)
                .orElseThrow(() -> new AppException("WALLET_NOT_FOUND", "Wallet not found", HttpStatus.NOT_FOUND));
        Wallet secondWallet = walletRepository.findByUserIdForUpdate(second)
                .orElseThrow(() -> new AppException("WALLET_NOT_FOUND", "Wallet not found", HttpStatus.NOT_FOUND));
        Wallet requesterWallet = first.equals(requesterId) ? firstWallet : secondWallet;
        Wallet recipientWallet = first.equals(requesterId) ? secondWallet : firstWallet;

        if (Boolean.TRUE.equals(requesterWallet.getFrozen())) {
            throw new AppException("WALLET_FROZEN", "The requesting admin's wallet is frozen", HttpStatus.FORBIDDEN);
        }
        if (requesterWallet.getBalance().compareTo(amount) < 0) {
            throw new AppException("INSUFFICIENT_FUNDS", "Requesting admin has insufficient balance", HttpStatus.BAD_REQUEST);
        }

        // Both wallets are already locked in canonical order above.
        walletLedger.transferLocked(requesterWallet, recipientWallet, amount, BigDecimal.ZERO, null);

        Transaction tx = Transaction.builder()
                .senderId(requesterId)
                .recipientId(recipientId)
                .amount(amount)
                .note(reference != null && !reference.isBlank() ? reference : "Admin fund transfer")
                .type(Transaction.TransactionType.DISBURSEMENT)
                .status(Transaction.TransactionStatus.COMPLETED)
                .idempotencyKey("admin_fund_transfer:" + approvalId)
                .completedAt(LocalDateTime.now())
                .build();
        transactionRepository.save(tx);

        auditService.log(approver, "ADMIN_FUND_TRANSFER", requester,
                "approvalId=" + approvalId + " recipientId=" + recipientId + " amount=" + amount
                        + " requestedBy=" + requester.getEmail());

        notificationService.sendMoneyReceivedNotification(
                recipientId, requester.getFirstName() + " " + requester.getLastName(),
                amount.toPlainString(), tx.getId().toString(), recipientWallet.getBalance());
    }

    private AdminUserResponse toAdminUserResponse(User user) {
        Wallet wallet = walletRepository.findByUserId(user.getId()).orElse(null);
        return AdminUserResponse.builder()
                .id(user.getId().toString())
                .email(user.getEmail())
                .phone(user.getPhoneNumber())
                .username(user.getUsername())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .profileImageUrl(user.getProfileImageUrl())
                .dateOfBirth(user.getDateOfBirth())
                .nationality(user.getNationality())
                .city(user.getCity())
                .homeAddress(user.getHomeAddress())
                .employmentStatus(user.getEmploymentStatus() != null ? user.getEmploymentStatus().name() : null)
                .accountStatus(user.getStatus().name())
                .kycStatus(user.getKycStatus().name())
                .role(user.getRole() != null ? user.getRole().name() : "USER")
                .twoFactorEnabled(user.getTwoFactorEnabled())
                .biometricsEnabled(user.getBiometricsEnabled())
                .walletBalance(wallet != null ? wallet.getBalance() : BigDecimal.ZERO)
                .walletCurrency(wallet != null ? wallet.getCurrency() : "GHS")
                .createdAt(user.getCreatedAt())
                .lastLoginAt(user.getLastLoginAt())
                .onlineStatus(presenceService.getStatus(user.getId()))
                .lastSeenAt(presenceService.getLastSeenLive(user.getId()) != null
                        ? presenceService.getLastSeenLive(user.getId())
                        : user.getLastSeenAt())
                .customDailyLimitGhs(user.getCustomDailyLimitGhs())
                .customSingleTransactionLimitGhs(user.getCustomSingleTransactionLimitGhs())
                .build();
    }

    // ── AI Admin: Fraud Detection ─────────────────────────────────────────────

    public Page<AdminTransactionResponse> getHeldTransactions(int page, int size) {
        return mapWithParties(transactionRepository.findByStatusOrderByInitiatedAtDesc(
                Transaction.TransactionStatus.HELD_FOR_REVIEW, PageRequest.of(page, size)));
    }

    public Page<AdminTransactionResponse> getFlaggedTransactions(String riskLevel, int page, int size) {
        PageRequest pageable = PageRequest.of(page, size);
        Page<Transaction> txPage = (riskLevel != null && !riskLevel.isBlank())
                ? transactionRepository.findByAnomalyRiskLevel(riskLevel.toUpperCase(), pageable)
                : transactionRepository.findFlaggedTransactions(pageable);
        return mapWithParties(txPage);
    }

    private Page<AdminTransactionResponse> mapWithParties(Page<Transaction> txPage) {

        return txPage.map(tx -> {
            User sender = userRepository.findById(tx.getSenderId()).orElse(null);
            // A merchant recipient is a merchants row, not a users row; looking it up as
        // a user is what made every store sale read as "Unknown" in the admin views.
        boolean toMerchant = tx.getRecipientType() == Transaction.RecipientType.MERCHANT;
        User recipient = toMerchant ? null : userRepository.findById(tx.getRecipientId()).orElse(null);
        Merchant recipientMerchant = toMerchant
                ? merchantRepository.findById(tx.getRecipientId()).orElse(null) : null;
            return AdminTransactionResponse.builder()
                    .id(tx.getId().toString())
                    .senderId(tx.getSenderId().toString())
                    .senderName(sender != null ? sender.getFirstName() + " " + sender.getLastName() : "Unknown")
                    .senderHandle(sender != null ? sender.getUsername() : null)
                    .recipientId(tx.getRecipientId().toString())
                    .recipientName(recipientMerchant != null ? recipientMerchant.getBusinessName()
                            : recipient != null ? recipient.getFirstName() + " " + recipient.getLastName() : "Unknown")
                    .recipientHandle(recipientMerchant != null ? recipientMerchant.getBusinessHandle()
                            : recipient != null ? recipient.getUsername() : null)
                    .amount(tx.getAmount())
                    .note(tx.getNote())
                    .type(tx.getType().name())
                    .status(tx.getStatus().name())
                    .initiatedAt(tx.getInitiatedAt())
                    .completedAt(tx.getCompletedAt())
                    .cancelledAt(tx.getCancelledAt())
                    .category(tx.getCategory() != null ? tx.getCategory().name() : null)
                    .anomalyScore(tx.getAnomalyScore())
                    .anomalyRiskLevel(tx.getAnomalyRiskLevel())
                    .initiationLocation(tx.getInitiationLocation())
                    .build();
        });
    }

    // ── AI Admin: Spending Category Analytics ─────────────────────────────────

    public List<Map<String, Object>> getCategoryBreakdown(int days) {
        LocalDateTime since = LocalDateTime.now().minusDays(days);
        List<Object[]> rows = transactionRepository.getCategoryBreakdown(since);

        BigDecimal grandTotal = rows.stream()
                .map(r -> (BigDecimal) r[2])
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<Map<String, Object>> result = new ArrayList<>();
        for (Object[] row : rows) {
            String category = ((Transaction.TransactionCategory) row[0]).name();
            long count = (long) row[1];
            BigDecimal total = (BigDecimal) row[2];
            double pct = grandTotal.compareTo(BigDecimal.ZERO) > 0
                    ? total.divide(grandTotal, 4, RoundingMode.HALF_UP).doubleValue() * 100
                    : 0.0;

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("category", category);
            item.put("count", count);
            item.put("total", total);
            item.put("percentage", Math.round(pct * 10.0) / 10.0);
            result.add(item);
        }
        return result;
    }
}
