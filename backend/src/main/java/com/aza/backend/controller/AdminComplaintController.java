package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.entity.Complaint;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.ComplaintRepository;
import com.aza.backend.service.AdminAuditService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

/** Complaints register with BoG-style handling deadlines: acknowledge in 5 days, resolve in 20. */
@RestController
@RequestMapping("/api/v1/admin/complaints")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','SUPPORT')")
public class AdminComplaintController {

    private final ComplaintRepository complaintRepository;
    private final AdminAuditService auditService;

    private static final int ACK_DAYS = 5;
    private static final int RESOLVE_DAYS = 20;

    @GetMapping
    public ResponseEntity<ApiResponse<Page<Complaint>>> list(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageRequest pageable = PageRequest.of(page, Math.min(size, 50));
        Page<Complaint> result = (status == null || status.isBlank())
                ? complaintRepository.findAllByOrderByCreatedAtDesc(pageable)
                : complaintRepository.findByStatusOrderByCreatedAtDesc(
                        Complaint.Status.valueOf(status.toUpperCase()), pageable);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<Map<String, Long>>> stats() {
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "open", complaintRepository.countByStatus(Complaint.Status.OPEN),
                "acknowledged", complaintRepository.countByStatus(Complaint.Status.ACKNOWLEDGED))));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Complaint>> create(
            @RequestBody CreateRequest request,
            @AuthenticationPrincipal User admin) {
        if (request.getSubject() == null || request.getSubject().isBlank()
                || request.getDetails() == null || request.getDetails().isBlank()) {
            throw new AppException("INVALID_COMPLAINT", "Subject and details are required", HttpStatus.BAD_REQUEST);
        }
        Complaint complaint = complaintRepository.save(Complaint.builder()
                .userId(request.getUserId())
                .complainantName(request.getComplainantName())
                .complainantContact(request.getComplainantContact())
                .channel(parseChannel(request.getChannel()))
                .subject(request.getSubject().trim())
                .details(request.getDetails())
                .ackDueAt(LocalDate.now().plusDays(ACK_DAYS))
                .resolveDueAt(LocalDate.now().plusDays(RESOLVE_DAYS))
                .build());
        auditService.log(admin, "LOG_COMPLAINT", null,
                "complaintId=" + complaint.getId() + " subject=" + complaint.getSubject());
        return ResponseEntity.ok(ApiResponse.success(complaint));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<ApiResponse<Complaint>> updateStatus(
            @PathVariable UUID id,
            @RequestBody StatusRequest request,
            @AuthenticationPrincipal User admin) {
        Complaint complaint = complaintRepository.findById(id)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Complaint not found", HttpStatus.NOT_FOUND));
        Complaint.Status newStatus;
        try {
            newStatus = Complaint.Status.valueOf(request.getStatus().toUpperCase());
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new AppException("INVALID_STATUS", "Status must be OPEN, ACKNOWLEDGED, or RESOLVED", HttpStatus.BAD_REQUEST);
        }
        if (newStatus == Complaint.Status.RESOLVED
                && (request.getResolution() == null || request.getResolution().isBlank())) {
            throw new AppException("RESOLUTION_REQUIRED", "A resolution note is required to resolve", HttpStatus.BAD_REQUEST);
        }
        complaint.setStatus(newStatus);
        complaint.setHandledBy(admin.getId());
        if (newStatus == Complaint.Status.ACKNOWLEDGED && complaint.getAcknowledgedAt() == null) {
            complaint.setAcknowledgedAt(LocalDateTime.now());
        }
        if (newStatus == Complaint.Status.RESOLVED) {
            if (complaint.getAcknowledgedAt() == null) {
                complaint.setAcknowledgedAt(LocalDateTime.now());
            }
            complaint.setResolvedAt(LocalDateTime.now());
            complaint.setResolution(request.getResolution());
        }
        complaintRepository.save(complaint);
        auditService.log(admin, "UPDATE_COMPLAINT", null,
                "complaintId=" + id + " status=" + newStatus);
        return ResponseEntity.ok(ApiResponse.success(complaint));
    }

    private Complaint.Channel parseChannel(String channel) {
        try {
            return Complaint.Channel.valueOf(channel.toUpperCase());
        } catch (IllegalArgumentException | NullPointerException e) {
            return Complaint.Channel.APP;
        }
    }

    @Data
    static class CreateRequest {
        private UUID userId;
        private String complainantName;
        private String complainantContact;
        private String channel;
        private String subject;
        private String details;
    }

    @Data
    static class StatusRequest {
        private String status;
        private String resolution;
    }
}
