package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.admin.AdminRoleRequest;
import com.aza.backend.dto.admin.AdminTransactionResponse;
import com.aza.backend.dto.admin.AdminUserResponse;
import com.aza.backend.dto.admin.AdminUserStatusRequest;
import com.aza.backend.entity.User;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.service.AdminAuditService;
import com.aza.backend.service.AdminService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/users")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {

    private final AdminService adminService;
    private final AdminAuditService auditService;
    private final UserRepository userRepository;
    private final com.aza.backend.service.UserService userService;
    private final com.aza.backend.service.NotificationService notificationService;
    private final com.aza.backend.util.EmailService emailService;
    private final com.aza.backend.service.SystemSettingService settingService;

    @GetMapping
    public ResponseEntity<ApiResponse<Page<AdminUserResponse>>> getUsers(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String kycStatus,
            @RequestParam(defaultValue = "false") boolean online,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                adminService.getUsers(query, status, kycStatus, online, page, size)));
    }

    @GetMapping("/{userId}")
    public ResponseEntity<ApiResponse<AdminUserResponse>> getUserDetail(@PathVariable UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(adminService.getUserDetail(userId)));
    }

    /** Device sessions for a user — same data as the mobile devices list, plus live online flags. */
    @GetMapping("/{userId}/sessions")
    public ResponseEntity<ApiResponse<Object>> getUserSessions(@PathVariable UUID userId) {
        User target = userRepository.findById(userId)
                .orElseThrow(() -> new com.aza.backend.exception.AppException("User not found"));
        return ResponseEntity.ok(ApiResponse.success(userService.getDevices(target, null)));
    }

    @GetMapping("/{userId}/transactions")
    public ResponseEntity<ApiResponse<Page<AdminTransactionResponse>>> getUserTransactions(
            @PathVariable UUID userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.success(adminService.getUserTransactions(userId, page, Math.min(size, 50))));
    }

    @PatchMapping("/{userId}/role")
    public ResponseEntity<ApiResponse<AdminUserResponse>> updateUserRole(
            @PathVariable UUID userId,
            @RequestBody AdminRoleRequest request,
            @AuthenticationPrincipal User admin) {
        AdminUserResponse result = adminService.updateUserRole(userId, request.getRole());
        User target = userRepository.findById(userId).orElse(null);
        auditService.log(admin, "CHANGE_ROLE", target,
                "newRole=" + request.getRole());
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PatchMapping("/{userId}/status")
    public ResponseEntity<ApiResponse<AdminUserResponse>> updateUserStatus(
            @PathVariable UUID userId,
            @RequestBody AdminUserStatusRequest request,
            @AuthenticationPrincipal User admin) {
        AdminUserResponse result = adminService.updateUserStatus(userId, request.getStatus(), request.getReason());
        User target = userRepository.findById(userId).orElse(null);
        String action = switch (request.getStatus().toUpperCase()) {
            case "SUSPENDED" -> "SUSPEND_USER";
            case "DEACTIVATED" -> "DEACTIVATE_USER";
            default -> "ACTIVATE_USER";
        };
        String details = "status=" + request.getStatus();
        if (request.getReason() != null && !request.getReason().isBlank()) {
            details += " reason=" + request.getReason();
        }
        auditService.log(admin, action, target, details);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PatchMapping("/{userId}/limits")
    public ResponseEntity<ApiResponse<AdminUserResponse>> updateUserLimits(
            @PathVariable UUID userId,
            @RequestBody UserLimitsRequest request,
            @AuthenticationPrincipal User admin) {
        User target = userRepository.findById(userId)
                .orElseThrow(() -> new com.aza.backend.exception.AppException("User not found"));

        com.aza.backend.dto.admin.SystemSettingsResponse settings = settingService.getSettings();
        java.math.BigDecimal prevDaily = target.getCustomDailyLimitGhs() != null
                ? target.getCustomDailyLimitGhs() : settings.getMaxDailyTransferGhs();
        java.math.BigDecimal prevSingle = target.getCustomSingleTransactionLimitGhs() != null
                ? target.getCustomSingleTransactionLimitGhs() : settings.getMaxSingleTransactionGhs();

        target.setCustomDailyLimitGhs(request.getDailyLimitGhs());
        target.setCustomSingleTransactionLimitGhs(request.getSingleTransactionLimitGhs());
        userRepository.save(target);

        java.math.BigDecimal newDaily = request.getDailyLimitGhs() != null
                ? request.getDailyLimitGhs() : settings.getMaxDailyTransferGhs();
        java.math.BigDecimal newSingle = request.getSingleTransactionLimitGhs() != null
                ? request.getSingleTransactionLimitGhs() : settings.getMaxSingleTransactionGhs();

        boolean dailyIncreased = newDaily.compareTo(prevDaily) > 0;
        boolean singleIncreased = newSingle.compareTo(prevSingle) > 0;

        if (dailyIncreased || singleIncreased) {
            String firstName = target.getFirstName() != null ? target.getFirstName() : "there";
            notificationService.sendNotification(
                    target.getId(),
                    com.aza.backend.entity.Notification.NotificationType.LIMIT_INCREASE,
                    "Your transaction limits have been increased",
                    buildLimitIncreaseBody(dailyIncreased, newDaily, singleIncreased, newSingle),
                    null, null);
            emailService.sendLimitIncreaseEmail(
                    target.getEmail(), firstName,
                    dailyIncreased, newDaily,
                    singleIncreased, newSingle);
        }

        auditService.log(admin, "UPDATE_TRANSACTION_LIMITS", target,
                "dailyLimit=" + request.getDailyLimitGhs() + " singleLimit=" + request.getSingleTransactionLimitGhs());
        return ResponseEntity.ok(ApiResponse.success(adminService.getUserDetail(userId)));
    }

    private String buildLimitIncreaseBody(boolean dailyUp, java.math.BigDecimal newDaily,
                                           boolean singleUp, java.math.BigDecimal newSingle) {
        if (dailyUp && singleUp) {
            return "Your daily limit is now GHS " + newDaily.toPlainString()
                    + " and your single-transaction limit is now GHS " + newSingle.toPlainString() + ".";
        } else if (dailyUp) {
            return "Your daily transfer limit has been increased to GHS " + newDaily.toPlainString() + ".";
        } else {
            return "Your single-transaction limit has been increased to GHS " + newSingle.toPlainString() + ".";
        }
    }

    @Data
    static class UserLimitsRequest {
        private BigDecimal dailyLimitGhs;
        private BigDecimal singleTransactionLimitGhs;
    }
}
