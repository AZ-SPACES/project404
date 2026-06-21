package com.aza.backend.service;

import com.aza.backend.dto.admin.ApprovalResponse;
import com.aza.backend.dto.admin.UserLimitsPayload;
import com.aza.backend.entity.PendingApproval;
import com.aza.backend.entity.StaffRole;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.PendingApprovalRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Maker-checker for sensitive admin actions. The initiating staff member's
 * request is stored, not executed; a different staff member holding the
 * action's owning role (or ADMIN) must approve, at which point the action runs
 * with the approver as the acting admin. Self-approval is rejected outright —
 * including for ADMINs — otherwise the control is decorative.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ApprovalService {

    private final PendingApprovalRepository approvalRepository;
    private final StaffRoleService staffRoleService;
    private final AdminAuditService auditService;
    private final AdminService adminService;
    private final FeeService feeService;
    private final UserLimitsService userLimitsService;
    private final SystemSettingService settingService;
    private final KycService kycService;
    private final MiniAppReportService miniAppReportService;
    private final BroadcastNotificationService broadcastNotificationService;
    private final StaffAlertService staffAlertService;
    private final AgentService agentService;
    private final FloatService floatService;
    private final AgentCommissionService agentCommissionService;
    private final UserWithdrawalService userWithdrawalService;
    private final ObjectMapper objectMapper;

    private static final int EXPIRY_DAYS = 7;

    @Transactional
    public ApprovalResponse submit(User requester, PendingApproval.ActionType actionType,
                                   UUID targetId, Object payload, String summary) {
        PendingApproval approval = approvalRepository.save(PendingApproval.builder()
                .actionType(actionType)
                .targetId(targetId)
                .payload(payload != null ? toJson(payload) : null)
                .summary(summary)
                .requestedBy(requester.getId())
                .requestedByEmail(requester.getEmail())
                .build());
        auditService.log(requester, "SUBMIT_FOR_APPROVAL", null,
                "action=" + actionType + " target=" + targetId + " approvalId=" + approval.getId());
        staffAlertService.alertRole(requiredRole(actionType), "Approval needed",
                requester.getEmail() + " requested: " + summary);
        return toResponse(approval);
    }

    @Transactional
    public ApprovalResponse approve(User approver, UUID approvalId, String notes) {
        PendingApproval approval = getPending(approvalId);

        if (approval.getRequestedBy().equals(approver.getId())) {
            throw new AppException("SELF_APPROVAL", "You cannot approve your own request", HttpStatus.FORBIDDEN);
        }
        StaffRole.Role required = requiredRole(approval.getActionType());
        if (!staffRoleService.getEffectiveRoles(approver).contains(required)) {
            throw new AppException("INSUFFICIENT_ROLE",
                    "Approving this action requires " + required + " or ADMIN", HttpStatus.FORBIDDEN);
        }

        // Execution failures (e.g. recipient already spent the funds) propagate so the
        // whole transaction rolls back; the request stays PENDING and the approver sees why.
        execute(approval, approver);

        approval.setStatus(PendingApproval.Status.APPROVED);
        finishReview(approval, approver, notes);
        auditService.log(approver, "APPROVE_ACTION", null,
                "action=" + approval.getActionType() + " target=" + approval.getTargetId()
                        + " requestedBy=" + approval.getRequestedByEmail());
        return toResponse(approvalRepository.save(approval));
    }

    @Transactional
    public ApprovalResponse reject(User reviewer, UUID approvalId, String notes) {
        PendingApproval approval = getPending(approvalId);
        approval.setStatus(PendingApproval.Status.REJECTED);
        finishReview(approval, reviewer, notes);
        auditService.log(reviewer, "REJECT_ACTION", null,
                "action=" + approval.getActionType() + " target=" + approval.getTargetId()
                        + " requestedBy=" + approval.getRequestedByEmail());
        return toResponse(approvalRepository.save(approval));
    }

    public Page<ApprovalResponse> list(String status, int page, int size) {
        PageRequest pageable = PageRequest.of(page, size);
        Page<PendingApproval> result = (status == null || status.isBlank())
                ? approvalRepository.findAllByOrderByRequestedAtDesc(pageable)
                : approvalRepository.findByStatusOrderByRequestedAtDesc(
                        PendingApproval.Status.valueOf(status.toUpperCase()), pageable);
        return result.map(this::toResponse);
    }

    public long pendingCount() {
        return approvalRepository.countByStatus(PendingApproval.Status.PENDING);
    }

    /** Stale pending requests expire rather than lingering as a foot-gun. Called by the daily scheduler. */
    @Transactional
    public int expireStale() {
        var stale = approvalRepository.findByStatusAndRequestedAtBefore(
                PendingApproval.Status.PENDING, LocalDateTime.now().minusDays(EXPIRY_DAYS));
        stale.forEach(a -> a.setStatus(PendingApproval.Status.EXPIRED));
        approvalRepository.saveAll(stale);
        if (!stale.isEmpty()) {
            log.info("Expired {} stale pending approvals", stale.size());
        }
        return stale.size();
    }

    private void execute(PendingApproval approval, User approver) {
        switch (approval.getActionType()) {
            case REVERSE_TRANSACTION ->
                    adminService.reverseTransaction(approval.getTargetId(), approver);
            case UPDATE_FEE_RULE ->
                    feeService.updateRule(approval.getTargetId(),
                            fromJson(approval.getPayload(), FeeService.FeeRuleUpdateRequest.class));
            case UPDATE_USER_LIMITS ->
                    userLimitsService.applyLimits(approver, approval.getTargetId(),
                            fromJson(approval.getPayload(), UserLimitsPayload.class));
            case GRANT_STAFF_ROLE ->
                    staffRoleService.grantRole(approver, approval.getTargetId(),
                            StaffRole.Role.valueOf(fromJson(approval.getPayload(), GrantRolePayload.class).getRole()));
            case CHANGE_STAFF_ROLE -> {
                ChangeRolePayload payload = fromJson(approval.getPayload(), ChangeRolePayload.class);
                staffRoleService.changeRole(approver, approval.getTargetId(),
                        StaffRole.Role.valueOf(payload.getFromRole()),
                        StaffRole.Role.valueOf(payload.getToRole()));
            }
            case UPDATE_SYSTEM_SETTINGS ->
                    settingService.updateSettings(
                            fromJson(approval.getPayload(), SystemSettingService.SystemSettingsRequest.class));
            case UNFREEZE_WALLET ->
                    adminService.freezeWallet(approval.getTargetId(), false);
            case REACTIVATE_USER ->
                    adminService.updateUserStatus(approval.getTargetId(), "ACTIVE",
                            fromJson(approval.getPayload(), ReasonPayload.class).getReason());
            case APPROVE_KYC ->
                    kycService.reviewRecord(approval.getTargetId(), true, "");
            case BROADCAST_NOTIFICATION ->
                    broadcastNotificationService.broadcast(fromJson(approval.getPayload(),
                            com.aza.backend.dto.admin.BroadcastNotificationRequest.class));
            case ENABLE_MINI_APP ->
                    miniAppReportService.enableApp(
                            fromJson(approval.getPayload(), EnableMiniAppPayload.class).getAppId());
            case APPROVE_AGENT ->
                    agentService.activate(approval.getTargetId());
            case UPDATE_AGENT_TERMS ->
                    agentService.updateTerms(approval.getTargetId(),
                            fromJson(approval.getPayload(), com.aza.backend.dto.agent.AgentTermsRequest.class));
            case MINT_FLOAT -> {
                FloatMovementPayload p = fromJson(approval.getPayload(), FloatMovementPayload.class);
                floatService.mint(approver, approval.getTargetId(), p.getAmount(), p.getReference());
            }
            case BURN_FLOAT -> {
                FloatMovementPayload p = fromJson(approval.getPayload(), FloatMovementPayload.class);
                floatService.burn(approver, approval.getTargetId(), p.getAmount(), p.getReference());
            }
            case SETTLE_COMMISSION -> {
                CommissionSettlementPayload p = fromJson(approval.getPayload(), CommissionSettlementPayload.class);
                agentCommissionService.settle(approver, approval.getTargetId(), p.getAmount(), p.getReference());
            }
            case APPROVE_WITHDRAWAL ->
                    userWithdrawalService.review(approver, approval.getTargetId(), "APPROVE",
                            approval.getPayload() != null
                                    ? fromJson(approval.getPayload(), ReasonPayload.class).getReason()
                                    : null);
        }
    }

    private StaffRole.Role requiredRole(PendingApproval.ActionType actionType) {
        return switch (actionType) {
            case REVERSE_TRANSACTION, UPDATE_FEE_RULE, UNFREEZE_WALLET,
                 MINT_FLOAT, BURN_FLOAT, APPROVE_WITHDRAWAL, SETTLE_COMMISSION -> StaffRole.Role.FINANCE;
            case UPDATE_USER_LIMITS, REACTIVATE_USER, APPROVE_KYC, APPROVE_AGENT,
                 UPDATE_AGENT_TERMS -> StaffRole.Role.COMPLIANCE;
            case GRANT_STAFF_ROLE, CHANGE_STAFF_ROLE, UPDATE_SYSTEM_SETTINGS,
                 BROADCAST_NOTIFICATION, ENABLE_MINI_APP -> StaffRole.Role.ADMIN;
        };
    }

    @lombok.Data
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class GrantRolePayload {
        private String role;
    }

    @lombok.Data
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class ChangeRolePayload {
        private String fromRole;
        private String toRole;
    }

    @lombok.Data
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class ReasonPayload {
        private String reason;
    }

    @lombok.Data
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class EnableMiniAppPayload {
        private String appId;
    }

    @lombok.Data
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class FloatMovementPayload {
        private BigDecimal amount;
        private String reference;
    }

    @lombok.Data
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class CommissionSettlementPayload {
        private BigDecimal amount;
        private String reference;
    }

    private PendingApproval getPending(UUID approvalId) {
        PendingApproval approval = approvalRepository.findById(approvalId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Approval not found", HttpStatus.NOT_FOUND));
        if (approval.getStatus() != PendingApproval.Status.PENDING) {
            throw new AppException("ALREADY_REVIEWED",
                    "This request is " + approval.getStatus(), HttpStatus.CONFLICT);
        }
        return approval;
    }

    private void finishReview(PendingApproval approval, User reviewer, String notes) {
        approval.setReviewedBy(reviewer.getId());
        approval.setReviewedByEmail(reviewer.getEmail());
        approval.setReviewedAt(LocalDateTime.now());
        approval.setReviewNotes(notes);
    }

    private String toJson(Object payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            throw new AppException("Failed to serialize approval payload", e);
        }
    }

    private <T> T fromJson(String json, Class<T> type) {
        try {
            return objectMapper.readValue(json, type);
        } catch (Exception e) {
            throw new AppException("Failed to read approval payload", e);
        }
    }

    private ApprovalResponse toResponse(PendingApproval a) {
        return ApprovalResponse.builder()
                .id(a.getId().toString())
                .actionType(a.getActionType().name())
                .targetId(a.getTargetId().toString())
                .summary(a.getSummary())
                .status(a.getStatus().name())
                .requestedByEmail(a.getRequestedByEmail())
                .requestedAt(a.getRequestedAt() != null ? a.getRequestedAt().toString() : null)
                .reviewedByEmail(a.getReviewedByEmail())
                .reviewedAt(a.getReviewedAt() != null ? a.getReviewedAt().toString() : null)
                .reviewNotes(a.getReviewNotes())
                .build();
    }
}
