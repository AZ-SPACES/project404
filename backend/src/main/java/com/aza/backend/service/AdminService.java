package com.aza.backend.service;

import com.aza.backend.dto.admin.AdminStatsResponse;
import com.aza.backend.dto.admin.AdminUserResponse;
import com.aza.backend.entity.Transaction;
import com.aza.backend.entity.User;
import com.aza.backend.entity.Wallet;
import com.aza.backend.exception.AppException;
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
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AdminService {

    private final UserRepository userRepository;
    private final WalletRepository walletRepository;
    private final TransactionRepository transactionRepository;

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
                .build();
    }

    private AdminUserResponse toAdminUserResponse(User user) {
        Wallet wallet = walletRepository.findByUserId(user.getId()).orElse(null);
        return AdminUserResponse.builder()
                .id(user.getId().toString())
                .email(user.getEmail())
                .phone(user.getPhone())
                .handle(user.getHandle())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .displayName(user.getDisplayName())
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
