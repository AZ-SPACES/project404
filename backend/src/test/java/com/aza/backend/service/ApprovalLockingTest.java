package com.aza.backend.service;

import com.aza.backend.entity.PendingApproval;
import com.aza.backend.entity.StaffRole;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.PendingApprovalRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Maker-checker is the control that stops one admin moving money alone. It only holds if
 * approving is serialised: the PENDING check in {@code getPending} is a read-modify-write
 * on the approval row, so an unlocked read lets two approvers clicking at the same moment
 * both pass the check and both execute — a double reversal, or a double fund transfer.
 *
 * <p>A unit test cannot stage the race itself; what it can pin down is that the lock is
 * taken at all, which is the part that regressed.
 */
class ApprovalLockingTest {

    private final PendingApprovalRepository approvalRepository = mock(PendingApprovalRepository.class);
    private final StaffRoleService staffRoleService = mock(StaffRoleService.class);
    private final AdminAuditService auditService = mock(AdminAuditService.class);
    private final AdminService adminService = mock(AdminService.class);
    private final FeeService feeService = mock(FeeService.class);
    private final UserLimitsService userLimitsService = mock(UserLimitsService.class);
    private final SystemSettingService settingService = mock(SystemSettingService.class);
    private final KycService kycService = mock(KycService.class);
    private final MiniAppReportService miniAppReportService = mock(MiniAppReportService.class);
    private final BroadcastNotificationService broadcastNotificationService =
            mock(BroadcastNotificationService.class);
    private final StaffAlertService staffAlertService = mock(StaffAlertService.class);
    private final AgentService agentService = mock(AgentService.class);
    private final FloatService floatService = mock(FloatService.class);
    private final AgentCommissionService agentCommissionService = mock(AgentCommissionService.class);
    private final UserWithdrawalService userWithdrawalService = mock(UserWithdrawalService.class);

    private final ApprovalService service = new ApprovalService(
            approvalRepository, staffRoleService, auditService, adminService, feeService,
            userLimitsService, settingService, kycService, miniAppReportService,
            broadcastNotificationService, staffAlertService, agentService, floatService,
            agentCommissionService, userWithdrawalService, new ObjectMapper());

    private final UUID targetTxId = UUID.randomUUID();
    private final User maker = User.builder().id(UUID.randomUUID()).email("maker@aza.systems").build();
    private final User checker = User.builder().id(UUID.randomUUID()).email("checker@aza.systems").build();

    private PendingApproval pendingReversal() {
        return PendingApproval.builder()
                .id(UUID.randomUUID())
                .actionType(PendingApproval.ActionType.REVERSE_TRANSACTION)
                .targetId(targetTxId)
                .status(PendingApproval.Status.PENDING)
                .requestedBy(maker.getId())
                .requestedByEmail(maker.getEmail())
                .build();
    }

    private void checkerHasFinance() {
        when(staffRoleService.getEffectiveRoles(checker))
                .thenReturn(Set.of(StaffRole.Role.FINANCE, StaffRole.Role.ADMIN));
        when(approvalRepository.save(any(PendingApproval.class))).thenAnswer(i -> i.getArgument(0));
    }

    @Test
    void approve_locksTheApprovalRowRatherThanReadingIt() {
        PendingApproval approval = pendingReversal();
        checkerHasFinance();
        when(approvalRepository.findByIdForUpdate(approval.getId())).thenReturn(Optional.of(approval));

        service.approve(checker, approval.getId(), "ok");

        verify(approvalRepository).findByIdForUpdate(approval.getId());
        verify(approvalRepository, never()).findById(approval.getId());
        verify(adminService).reverseTransaction(targetTxId, checker);
        assertEquals(PendingApproval.Status.APPROVED, approval.getStatus());
    }

    @Test
    void secondApproverFindsItAlreadyReviewed_andNothingExecutes() {
        // What the loser of the race sees once the winner commits.
        PendingApproval approval = pendingReversal();
        approval.setStatus(PendingApproval.Status.APPROVED);
        when(approvalRepository.findByIdForUpdate(approval.getId())).thenReturn(Optional.of(approval));

        AppException e = assertThrows(AppException.class,
                () -> service.approve(checker, approval.getId(), "ok"));

        assertEquals("ALREADY_REVIEWED", e.getCode());
        verify(adminService, never()).reverseTransaction(any(), any());
    }

    @Test
    void makerCannotApproveTheirOwnRequest() {
        PendingApproval approval = pendingReversal();
        when(approvalRepository.findByIdForUpdate(approval.getId())).thenReturn(Optional.of(approval));

        AppException e = assertThrows(AppException.class,
                () -> service.approve(maker, approval.getId(), "ok"));

        assertEquals("SELF_APPROVAL", e.getCode());
        verify(adminService, never()).reverseTransaction(any(), any());
    }

    @Test
    void approverWithoutTheRequiredRoleExecutesNothing() {
        PendingApproval approval = pendingReversal();
        when(approvalRepository.findByIdForUpdate(approval.getId())).thenReturn(Optional.of(approval));
        when(staffRoleService.getEffectiveRoles(checker)).thenReturn(Set.of(StaffRole.Role.SUPPORT));

        AppException e = assertThrows(AppException.class,
                () -> service.approve(checker, approval.getId(), "ok"));

        assertEquals("INSUFFICIENT_ROLE", e.getCode());
        verify(adminService, never()).reverseTransaction(any(), any());
    }

    @Test
    void rejectAlsoLocksTheRow() {
        PendingApproval approval = pendingReversal();
        when(approvalRepository.findByIdForUpdate(approval.getId())).thenReturn(Optional.of(approval));
        when(approvalRepository.save(any(PendingApproval.class))).thenAnswer(i -> i.getArgument(0));

        service.reject(checker, approval.getId(), "no");

        // Reject races approve for the same row; both must serialise on it.
        verify(approvalRepository).findByIdForUpdate(approval.getId());
        verify(approvalRepository, never()).findById(approval.getId());
        assertEquals(PendingApproval.Status.REJECTED, approval.getStatus());
    }
}
