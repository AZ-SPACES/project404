package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.admin.AdminRoleRequest;
import com.aza.backend.dto.admin.AdminTransactionResponse;
import com.aza.backend.dto.admin.AdminUserResponse;
import com.aza.backend.dto.admin.AdminUserStatusRequest;
import com.aza.backend.entity.Notification;
import com.aza.backend.entity.User;
import com.aza.backend.entity.AccountRecoveryContact;
import com.aza.backend.entity.FlaggedTransaction;
import com.aza.backend.repository.AccountRecoveryContactRepository;
import com.aza.backend.repository.FlaggedTransactionRepository;
import com.aza.backend.repository.NotificationRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.service.AdminAuditService;
import com.aza.backend.service.AdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/users")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','SUPPORT','COMPLIANCE')")
public class AdminUserController {

    private final AdminService adminService;
    private final AdminAuditService auditService;
    private final UserRepository userRepository;
    private final com.aza.backend.service.UserService userService;
    private final com.aza.backend.service.StaffRoleService staffRoleService;
    private final com.aza.backend.service.ApprovalService approvalService;
    private final NotificationRepository notificationRepository;
    private final FlaggedTransactionRepository flaggedTxRepository;
    private final AccountRecoveryContactRepository recoveryContactRepository;

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

    /**
     * Force-logout one device session: deletes the refresh token and blacklists
     * its paired access token, so the device is signed out immediately.
     */
    @PreAuthorize("hasAnyRole('ADMIN','SUPPORT')")
    @DeleteMapping("/{userId}/sessions/{sessionId}")
    public ResponseEntity<ApiResponse<Object>> revokeUserSession(
            @PathVariable UUID userId,
            @PathVariable UUID sessionId,
            @AuthenticationPrincipal User admin) {
        User target = userRepository.findById(userId)
                .orElseThrow(() -> new com.aza.backend.exception.AppException("User not found"));
        userService.removeDevice(target, sessionId);
        auditService.log(admin, "REVOKE_SESSION", target, "sessionId=" + sessionId);
        return ResponseEntity.ok(ApiResponse.success("Session revoked"));
    }

    @GetMapping("/{userId}/transactions")
    public ResponseEntity<ApiResponse<Page<AdminTransactionResponse>>> getUserTransactions(
            @PathVariable UUID userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.success(adminService.getUserTransactions(userId, page, Math.min(size, 50))));
    }

    /**
     * Legacy USER/ADMIN toggle — backed by staff_roles. Granting ADMIN goes
     * through maker-checker like the staff API (revoking stays direct: it
     * reduces power and must never be blockable by the person losing it).
     */
    @PreAuthorize("hasRole('ADMIN')")
    @PatchMapping("/{userId}/role")
    public ResponseEntity<ApiResponse<Object>> updateUserRole(
            @PathVariable UUID userId,
            @RequestBody AdminRoleRequest request,
            @AuthenticationPrincipal User admin) {
        boolean granting = "ADMIN".equalsIgnoreCase(request.getRole());
        if (granting && staffRoleService.countActiveStaffUsers() > 1) {
            User target = userRepository.findById(userId)
                    .orElseThrow(() -> new com.aza.backend.exception.AppException("User not found"));
            return ResponseEntity.ok(ApiResponse.success(approvalService.submit(
                    admin, com.aza.backend.entity.PendingApproval.ActionType.GRANT_STAFF_ROLE, userId,
                    new com.aza.backend.service.ApprovalService.GrantRolePayload("ADMIN"),
                    "Grant ADMIN to " + target.getEmail())));
        }
        staffRoleService.setLegacyRole(admin, userId, request.getRole());
        return ResponseEntity.ok(ApiResponse.success(adminService.getUserDetail(userId)));
    }

    /**
     * Suspending/deactivating is immediate (protective); REACTIVATING a
     * suspended account is risk-increasing and goes through maker-checker.
     */
    @PreAuthorize("hasAnyRole('ADMIN','COMPLIANCE')")
    @PatchMapping("/{userId}/status")
    public ResponseEntity<ApiResponse<Object>> updateUserStatus(
            @PathVariable UUID userId,
            @RequestBody AdminUserStatusRequest request,
            @AuthenticationPrincipal User admin) {
        if ("ACTIVE".equalsIgnoreCase(request.getStatus())
                && staffRoleService.countActiveStaffUsers() > 1) {
            User reactivateTarget = userRepository.findById(userId)
                    .orElseThrow(() -> new com.aza.backend.exception.AppException("User not found"));
            return ResponseEntity.ok(ApiResponse.success(approvalService.submit(
                    admin, com.aza.backend.entity.PendingApproval.ActionType.REACTIVATE_USER, userId,
                    new com.aza.backend.service.ApprovalService.ReasonPayload(request.getReason()),
                    "Reactivate account of " + reactivateTarget.getEmail())));
        }
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

    @GetMapping("/{userId}/notifications")
    public ResponseEntity<ApiResponse<Page<Notification>>> getUserNotifications(
            @PathVariable UUID userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                notificationRepository.findAllByUserIdOrderByCreatedAtDesc(
                        userId, PageRequest.of(page, Math.min(size, 50)))));
    }

    /** Account recovery contacts configured by a user (their trusted helpers). */
    @GetMapping("/{userId}/recovery-contacts")
    public ResponseEntity<ApiResponse<java.util.List<AccountRecoveryContact>>> getRecoveryContacts(
            @PathVariable UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(
                recoveryContactRepository.findAllByUserIdAndStatusNot(
                        userId, AccountRecoveryContact.Status.REMOVED)));
    }

    /** Flagged transactions for a user — their risk history. */
    @GetMapping("/{userId}/risk-history")
    public ResponseEntity<ApiResponse<Page<FlaggedTransaction>>> getRiskHistory(
            @PathVariable UUID userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                flaggedTxRepository.findAllByUserIdOrderByFlaggedAtDesc(
                        userId, PageRequest.of(page, Math.min(size, 50)))));
    }

    /** Maker-checker: limit changes are submitted for a second COMPLIANCE/ADMIN to approve. */
    @PreAuthorize("hasAnyRole('ADMIN','COMPLIANCE')")
    @PatchMapping("/{userId}/limits")
    public ResponseEntity<ApiResponse<com.aza.backend.dto.admin.ApprovalResponse>> updateUserLimits(
            @PathVariable UUID userId,
            @RequestBody com.aza.backend.dto.admin.UserLimitsPayload request,
            @AuthenticationPrincipal User admin) {
        User target = userRepository.findById(userId)
                .orElseThrow(() -> new com.aza.backend.exception.AppException("User not found"));
        return ResponseEntity.ok(ApiResponse.success(approvalService.submit(
                admin, com.aza.backend.entity.PendingApproval.ActionType.UPDATE_USER_LIMITS, userId, request,
                "Set limits for " + target.getEmail() + " (daily=" + request.getDailyLimitGhs()
                        + ", single=" + request.getSingleTransactionLimitGhs() + ")")));
    }
}
