package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.entity.AdminNote;
import com.aza.backend.entity.Transaction;
import com.aza.backend.entity.User;
import com.aza.backend.entity.Wallet;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.AdminNoteRepository;
import com.aza.backend.repository.RefreshTokenRepository;
import com.aza.backend.repository.TransactionRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.repository.WalletRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/cs")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','SUPPORT')")
public class AdminCSController {

    private final UserRepository userRepository;
    private final WalletRepository walletRepository;
    private final TransactionRepository transactionRepository;
    private final AdminNoteRepository adminNoteRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final com.aza.backend.service.AuthService authService;

    // ====================== USER SEARCH ======================

    @GetMapping("/users")
    public ResponseEntity<ApiResponse<Page<UserSummary>>> searchUsers(
            @RequestParam(required = false, defaultValue = "") String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageRequest pageable = PageRequest.of(page, Math.min(size, 50));
        Page<User> users = q.isBlank()
                ? userRepository.findAll(pageable)
                : userRepository.adminSearchUsers(q, pageable);
        return ResponseEntity.ok(ApiResponse.success(users.map(UserSummary::from)));
    }

    // ====================== USER DETAIL ======================

    @GetMapping("/users/{userId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getUserDetail(@PathVariable UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "User not found", HttpStatus.NOT_FOUND));

        Wallet wallet = walletRepository.findByUserId(userId).orElse(null);

        List<Transaction> recentTx = transactionRepository
                .findAllByUserId(userId, PageRequest.of(0, 5))
                .getContent();

        Map<String, Object> result = new HashMap<>();
        result.put("id", user.getId());
        result.put("email", user.getEmail());
        result.put("phoneNumber", user.getPhoneNumber());
        result.put("firstName", user.getFirstName());
        result.put("lastName", user.getLastName());
        result.put("username", user.getUsername());
        result.put("status", user.getStatus());
        result.put("kycStatus", user.getKycStatus());
        result.put("createdAt", user.getCreatedAt());
        result.put("lastLoginAt", user.getLastLoginAt());
        result.put("twoFactorEnabled", user.getTwoFactorEnabled());
        result.put("biometricsEnabled", user.getBiometricsEnabled());
        result.put("walletBalance", wallet != null ? wallet.getBalance() : BigDecimal.ZERO);
        result.put("walletFrozen", wallet != null && Boolean.TRUE.equals(wallet.getFrozen()));
        result.put("recentTransactions", recentTx);

        return ResponseEntity.ok(ApiResponse.success(result));
    }

    // ====================== BALANCE ADJUSTMENT ======================

    @PostMapping("/users/{userId}/adjust-balance")
    @Transactional
    public ResponseEntity<ApiResponse<Map<String, Object>>> adjustBalance(
            @PathVariable UUID userId,
            @RequestBody AdjustBalanceRequest body) {
        if (body.amount() == null || body.amount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new AppException("INVALID_AMOUNT", "Amount must be positive", HttpStatus.BAD_REQUEST);
        }
        Wallet wallet = walletRepository.findByUserIdForUpdate(userId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Wallet not found", HttpStatus.NOT_FOUND));

        BigDecimal newBalance;
        if ("CREDIT".equalsIgnoreCase(body.type())) {
            newBalance = wallet.getBalance().add(body.amount());
        } else if ("DEBIT".equalsIgnoreCase(body.type())) {
            newBalance = wallet.getBalance().subtract(body.amount());
            if (newBalance.compareTo(BigDecimal.ZERO) < 0) {
                throw new AppException("INSUFFICIENT_BALANCE", "Debit would result in negative balance", HttpStatus.BAD_REQUEST);
            }
        } else {
            throw new AppException("INVALID_TYPE", "Type must be CREDIT or DEBIT", HttpStatus.BAD_REQUEST);
        }

        wallet.setBalance(newBalance);
        walletRepository.save(wallet);

        Map<String, Object> result = new HashMap<>();
        result.put("newBalance", newBalance);
        result.put("type", body.type());
        result.put("amount", body.amount());
        result.put("reason", body.reason());
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    // ====================== FORCE LOGOUT ======================

    @PostMapping("/users/{userId}/force-logout")
    @Transactional
    public ResponseEntity<ApiResponse<String>> forceLogout(@PathVariable UUID userId) {
        if (!userRepository.existsById(userId)) {
            throw new AppException("NOT_FOUND", "User not found", HttpStatus.NOT_FOUND);
        }
        // Delete all refresh tokens — on next API call the access token will be rejected
        // because the paired refresh token no longer exists and future refreshes will fail.
        refreshTokenRepository.deleteAllByUserId(userId);
        return ResponseEntity.ok(ApiResponse.success("All sessions invalidated for user " + userId));
    }

    // ====================== LOCK / UNLOCK ======================

    @PostMapping("/users/{userId}/lock")
    public ResponseEntity<ApiResponse<UserSummary>> lockUser(@PathVariable UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "User not found", HttpStatus.NOT_FOUND));
        user.setStatus(User.AccountStatus.SUSPENDED);
        userRepository.save(user);
        return ResponseEntity.ok(ApiResponse.success(UserSummary.from(user)));
    }

    @PostMapping("/users/{userId}/unlock")
    public ResponseEntity<ApiResponse<UserSummary>> unlockUser(@PathVariable UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "User not found", HttpStatus.NOT_FOUND));
        user.setStatus(User.AccountStatus.ACTIVE);
        userRepository.save(user);
        return ResponseEntity.ok(ApiResponse.success(UserSummary.from(user)));
    }

    // ====================== CREDENTIAL RESETS ======================

    /** Clear the user's payment passcode — they must set a new one before they can pay again. */
    @PostMapping("/users/{userId}/reset-passcode")
    public ResponseEntity<ApiResponse<String>> resetPasscode(@PathVariable UUID userId) {
        authService.adminResetPasscode(userId);
        return ResponseEntity.ok(ApiResponse.success("Passcode cleared. User must set a new passcode."));
    }

    /** Force a password reset — flags the account, ends all sessions, and notifies the user. */
    @PostMapping("/users/{userId}/reset-password")
    public ResponseEntity<ApiResponse<String>> resetPassword(@PathVariable UUID userId) {
        authService.adminForcePasswordReset(userId);
        return ResponseEntity.ok(ApiResponse.success("Password reset forced. User must set a new password."));
    }

    // ====================== ADMIN NOTES ======================

    @PostMapping("/users/{userId}/notes")
    public ResponseEntity<ApiResponse<AdminNote>> createNote(
            @PathVariable UUID userId,
            @RequestBody NoteRequest body,
            @AuthenticationPrincipal User adminUser) {
        if (!userRepository.existsById(userId)) {
            throw new AppException("NOT_FOUND", "User not found", HttpStatus.NOT_FOUND);
        }
        AdminNote note = AdminNote.builder()
                .subjectUserId(userId)
                .note(body.note())
                .createdBy(adminUser.getEmail())
                .build();
        return ResponseEntity.ok(ApiResponse.success(adminNoteRepository.save(note)));
    }

    @GetMapping("/users/{userId}/notes")
    public ResponseEntity<ApiResponse<List<AdminNote>>> getNotes(@PathVariable UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(
                adminNoteRepository.findBySubjectUserIdOrderByCreatedAtDesc(userId)));
    }

    // ====================== DTOs ======================

    record AdjustBalanceRequest(BigDecimal amount, String type, String reason) {}

    record NoteRequest(String note) {}

    record UserSummary(
            UUID id,
            String email,
            String phoneNumber,
            String firstName,
            String lastName,
            User.AccountStatus status,
            User.KycStatus kycStatus,
            LocalDateTime createdAt
    ) {
        static UserSummary from(User u) {
            return new UserSummary(
                    u.getId(), u.getEmail(), u.getPhoneNumber(),
                    u.getFirstName(), u.getLastName(),
                    u.getStatus(), u.getKycStatus(), u.getCreatedAt());
        }
    }
}
