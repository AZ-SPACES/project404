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
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AdminService {

    private final UserRepository userRepository;
    private final WalletRepository walletRepository;
    private final TransactionRepository transactionRepository;
    private final KycRecordRepository kycRecordRepository;
    private final MerchantRepository merchantRepository;
    private final PresenceService presenceService;
    private final AdminAuditService auditService;

    public Page<AdminUserResponse> getUsers(String query, String status, String kycStatus, int page, int size) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());

        Page<User> users;
        if (query != null && !query.isBlank()) {
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
    public AdminUserResponse updateUserRole(UUID userId, String newRole) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException("USER_NOT_FOUND", "User not found", HttpStatus.NOT_FOUND));
        user.setRole(User.UserRole.valueOf(newRole.toUpperCase()));
        userRepository.save(user);
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

    public Page<AdminTransactionResponse> getTransactions(int page, int size) {
        PageRequest pageable = PageRequest.of(page, size);
        return transactionRepository.findAllOrderByInitiatedAtDesc(pageable)
                .map(tx -> {
                    User sender = userRepository.findById(tx.getSenderId()).orElse(null);
                    User recipient = userRepository.findById(tx.getRecipientId()).orElse(null);
                    return AdminTransactionResponse.builder()
                            .id(tx.getId().toString())
                            .senderId(tx.getSenderId().toString())
                            .senderName(sender != null ? sender.getFirstName() + " " + sender.getLastName() : "Unknown")
                            .senderHandle(sender != null ? sender.getUsername() : null)
                            .recipientId(tx.getRecipientId().toString())
                            .recipientName(recipient != null ? recipient.getFirstName() + " " + recipient.getLastName() : "Unknown")
                            .recipientHandle(recipient != null ? recipient.getUsername() : null)
                            .amount(tx.getAmount())
                            .note(tx.getNote())
                            .type(tx.getType().name())
                            .status(tx.getStatus().name())
                            .initiatedAt(tx.getInitiatedAt())
                            .completedAt(tx.getCompletedAt())
                            .cancelledAt(tx.getCancelledAt())
                            .build();
                });
    }

    public Page<AdminTransactionResponse> getUserTransactions(UUID userId, int page, int size) {
        PageRequest pageable = PageRequest.of(page, size);
        return transactionRepository.findAllByUserId(userId, pageable)
                .map(tx -> {
                    User sender = userRepository.findById(tx.getSenderId()).orElse(null);
                    User recipient = userRepository.findById(tx.getRecipientId()).orElse(null);
                    return AdminTransactionResponse.builder()
                            .id(tx.getId().toString())
                            .senderId(tx.getSenderId().toString())
                            .senderName(sender != null ? sender.getFirstName() + " " + sender.getLastName() : "Unknown")
                            .senderHandle(sender != null ? sender.getUsername() : null)
                            .recipientId(tx.getRecipientId().toString())
                            .recipientName(recipient != null ? recipient.getFirstName() + " " + recipient.getLastName() : "Unknown")
                            .recipientHandle(recipient != null ? recipient.getUsername() : null)
                            .amount(tx.getAmount())
                            .note(tx.getNote())
                            .type(tx.getType().name())
                            .status(tx.getStatus().name())
                            .initiatedAt(tx.getInitiatedAt())
                            .completedAt(tx.getCompletedAt())
                            .cancelledAt(tx.getCancelledAt())
                            .build();
                });
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

        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        LocalDateTime endOfDay = startOfDay.plusDays(1);
        long transactionsToday = transactionRepository.countByInitiatedAtBetween(startOfDay, endOfDay);
        BigDecimal volumeToday = transactionRepository.sumVolumeByInitiatedAtBetween(startOfDay, endOfDay);

        long totalMerchants = merchantRepository.count();
        long activeMerchants = merchantRepository.countByStatus(Merchant.MerchantStatus.ACTIVE);
        long pendingKybMerchants = merchantRepository.countByStatus(Merchant.MerchantStatus.KYB_UNDER_REVIEW)
                + merchantRepository.countByStatus(Merchant.MerchantStatus.KYB_SUBMITTED);
        BigDecimal totalMerchantVolume = merchantRepository.sumActiveMerchantVolume();

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
        User recipient = userRepository.findById(tx.getRecipientId()).orElse(null);
        return AdminTransactionResponse.builder()
                .id(tx.getId().toString())
                .senderId(tx.getSenderId().toString())
                .senderName(sender != null ? sender.getFirstName() + " " + sender.getLastName() : "Unknown")
                .senderHandle(sender != null ? sender.getUsername() : null)
                .recipientId(tx.getRecipientId().toString())
                .recipientName(recipient != null ? recipient.getFirstName() + " " + recipient.getLastName() : "Unknown")
                .recipientHandle(recipient != null ? recipient.getUsername() : null)
                .amount(tx.getAmount())
                .note(tx.getNote())
                .type(tx.getType().name())
                .status(tx.getStatus().name())
                .initiatedAt(tx.getInitiatedAt())
                .completedAt(tx.getCompletedAt())
                .cancelledAt(tx.getCancelledAt())
                .build();
    }

    @Transactional
    public AdminTransactionResponse reverseTransaction(UUID transactionId, User admin) {
        Transaction tx = transactionRepository.findById(transactionId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Transaction not found", HttpStatus.NOT_FOUND));

        if (tx.getStatus() != Transaction.TransactionStatus.COMPLETED) {
            throw new AppException("INVALID_STATE", "Only COMPLETED transactions can be reversed", HttpStatus.BAD_REQUEST);
        }

        // Add the amount back to the sender
        Wallet senderWallet = walletRepository.findByUserId(tx.getSenderId())
                .orElseThrow(() -> new AppException("WALLET_NOT_FOUND", "Sender wallet not found", HttpStatus.NOT_FOUND));
        senderWallet.setBalance(senderWallet.getBalance().add(tx.getAmount()));
        walletRepository.save(senderWallet);
 
        // Update sender balance in user table
        User senderUser = userRepository.findById(tx.getSenderId()).orElse(null);
        if (senderUser != null) {
            senderUser.setBalance(senderWallet.getBalance());
            userRepository.save(senderUser);
        }

        // Deduct from the recipient (check they have enough)
        Wallet recipientWallet = walletRepository.findByUserId(tx.getRecipientId())
                .orElseThrow(() -> new AppException("WALLET_NOT_FOUND", "Recipient wallet not found", HttpStatus.NOT_FOUND));
        if (recipientWallet.getBalance().compareTo(tx.getAmount()) < 0) {
            throw new AppException("INSUFFICIENT_FUNDS", "Recipient has insufficient funds for reversal", HttpStatus.BAD_REQUEST);
        }
        recipientWallet.setBalance(recipientWallet.getBalance().subtract(tx.getAmount()));
        walletRepository.save(recipientWallet);
 
        // Update recipient balance in user table
        User recipientUser = userRepository.findById(tx.getRecipientId()).orElse(null);
        if (recipientUser != null) {
            recipientUser.setBalance(recipientWallet.getBalance());
            userRepository.save(recipientUser);
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
        User recipient = userRepository.findById(tx.getRecipientId()).orElse(null);
        return AdminTransactionResponse.builder()
                .id(tx.getId().toString())
                .senderId(tx.getSenderId().toString())
                .senderName(sender != null ? sender.getFirstName() + " " + sender.getLastName() : "Unknown")
                .senderHandle(sender != null ? sender.getUsername() : null)
                .recipientId(tx.getRecipientId().toString())
                .recipientName(recipient != null ? recipient.getFirstName() + " " + recipient.getLastName() : "Unknown")
                .recipientHandle(recipient != null ? recipient.getUsername() : null)
                .amount(tx.getAmount())
                .note(tx.getNote())
                .type(tx.getType().name())
                .status(tx.getStatus().name())
                .initiatedAt(tx.getInitiatedAt())
                .completedAt(tx.getCompletedAt())
                .cancelledAt(tx.getCancelledAt())
                .build();
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
                .build();
    }
}
