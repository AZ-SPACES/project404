package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.entity.Complaint;
import com.aza.backend.entity.DataRequest;
import com.aza.backend.entity.KycRecord;
import com.aza.backend.entity.PendingApproval;
import com.aza.backend.repository.ComplaintRepository;
import com.aza.backend.repository.DataRequestRepository;
import com.aza.backend.repository.KycRecordRepository;
import com.aza.backend.repository.PendingApprovalRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/sla")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','COMPLIANCE','SUPPORT')")
public class AdminSlaController {

    private final ComplaintRepository complaintRepository;
    private final DataRequestRepository dataRequestRepository;
    private final KycRecordRepository kycRecordRepository;
    private final PendingApprovalRepository pendingApprovalRepository;

    @GetMapping("/dashboard")
    public ResponseEntity<ApiResponse<Map<String, Object>>> dashboard() {
        LocalDate today = LocalDate.now();
        LocalDateTime cutoff48h = LocalDateTime.now().minusHours(48);
        // Approvals older than 7 days are considered stale
        LocalDateTime approvalCutoff = LocalDateTime.now().minusDays(7);

        long kycPendingOver48h = kycRecordRepository
                .countByStatusAndSubmittedAtBefore(KycRecord.KycStatus.PENDING, cutoff48h);

        long complaintsBreachingAck = complaintRepository
                .countByStatusAndAckDueAtBefore(Complaint.Status.OPEN, today);

        long complaintsBreachingResolve = complaintRepository
                .countByStatusInAndResolveDueAtBefore(
                        List.of(Complaint.Status.OPEN, Complaint.Status.ACKNOWLEDGED), today);

        long dsarOverdue = dataRequestRepository
                .countByStatusInAndDueDateBefore(
                        List.of(DataRequest.Status.OPEN, DataRequest.Status.IN_PROGRESS), today);

        long approvalsStale = pendingApprovalRepository
                .findByStatusAndRequestedAtBefore(PendingApproval.Status.PENDING, approvalCutoff)
                .size();

        long kycUnderReview = kycRecordRepository.countByStatus(KycRecord.KycStatus.UNDER_REVIEW);
        long kycPendingTotal = kycRecordRepository.countByStatus(KycRecord.KycStatus.PENDING);
        long complaintsOpen = complaintRepository.countByStatus(Complaint.Status.OPEN);
        long dsarOpen = dataRequestRepository.countByStatus(DataRequest.Status.OPEN);
        long approvalsPending = pendingApprovalRepository.countByStatus(PendingApproval.Status.PENDING);

        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "kycPendingOver48h", kycPendingOver48h,
                "kycUnderReview", kycUnderReview,
                "kycPendingTotal", kycPendingTotal,
                "complaintsBreachingAck", complaintsBreachingAck,
                "complaintsBreachingResolve", complaintsBreachingResolve,
                "complaintsOpen", complaintsOpen,
                "dsarOverdue", dsarOverdue,
                "dsarOpen", dsarOpen,
                "approvalsStale", approvalsStale,
                "approvalsPending", approvalsPending
        )));
    }
}
