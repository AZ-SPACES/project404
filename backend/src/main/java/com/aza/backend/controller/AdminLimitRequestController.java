package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.entity.LimitIncreaseRequest;
import com.aza.backend.entity.Notification;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.LimitIncreaseRequestRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.service.AdminAuditService;
import com.aza.backend.service.NotificationService;
import com.aza.backend.service.SystemSettingService;
import com.aza.backend.util.EmailService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/limit-requests")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminLimitRequestController {

    private final LimitIncreaseRequestRepository requestRepo;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final EmailService emailService;
    private final AdminAuditService auditService;
    private final SystemSettingService settingService;

    @GetMapping
    public ResponseEntity<ApiResponse<Page<LimitIncreaseRequest>>> getRequests(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String status) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<LimitIncreaseRequest> result = status != null
                ? requestRepo.findByStatus(LimitIncreaseRequest.Status.valueOf(status), pageable)
                : requestRepo.findAll(pageable);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<Map<String, Long>>> getStats() {
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "pending", requestRepo.countByStatus(LimitIncreaseRequest.Status.PENDING),
                "approved", requestRepo.countByStatus(LimitIncreaseRequest.Status.APPROVED),
                "denied", requestRepo.countByStatus(LimitIncreaseRequest.Status.DENIED)
        )));
    }

    @PostMapping("/{id}/approve")
    @Transactional
    public ResponseEntity<ApiResponse<LimitIncreaseRequest>> approve(
            @PathVariable UUID id,
            @RequestBody ReviewRequest body,
            @AuthenticationPrincipal User admin) {
        LimitIncreaseRequest req = requestRepo.findById(id)
                .orElseThrow(() -> new AppException("Request not found"));
        if (req.getStatus() != LimitIncreaseRequest.Status.PENDING) {
            throw new AppException("Request has already been reviewed");
        }

        User target = userRepository.findById(req.getUserId())
                .orElseThrow(() -> new AppException("User not found"));

        var settings = settingService.getSettings();
        BigDecimal prevDaily = target.getCustomDailyLimitGhs() != null
                ? target.getCustomDailyLimitGhs() : settings.getMaxDailyTransferGhs();
        BigDecimal prevSingle = target.getCustomSingleTransactionLimitGhs() != null
                ? target.getCustomSingleTransactionLimitGhs() : settings.getMaxSingleTransactionGhs();

        target.setCustomDailyLimitGhs(req.getRequestedDailyLimitGhs());
        target.setCustomSingleTransactionLimitGhs(req.getRequestedSingleTransactionLimitGhs());
        userRepository.save(target);

        req.setStatus(LimitIncreaseRequest.Status.APPROVED);
        req.setAdminNotes(body.getNotes());
        req.setReviewedBy(admin.getId());
        req.setReviewedAt(LocalDateTime.now());
        requestRepo.save(req);

        boolean dailyUp = req.getRequestedDailyLimitGhs().compareTo(prevDaily) > 0;
        boolean singleUp = req.getRequestedSingleTransactionLimitGhs().compareTo(prevSingle) > 0;

        notificationService.sendNotification(
                target.getId(),
                Notification.NotificationType.LIMIT_INCREASE,
                "Your transaction limits have been increased",
                buildBody(dailyUp, req.getRequestedDailyLimitGhs(), singleUp, req.getRequestedSingleTransactionLimitGhs()),
                null, null);
        emailService.sendLimitIncreaseEmail(
                target.getEmail(),
                target.getFirstName() != null ? target.getFirstName() : "there",
                dailyUp, req.getRequestedDailyLimitGhs(),
                singleUp, req.getRequestedSingleTransactionLimitGhs());

        auditService.log(admin, "APPROVE_LIMIT_REQUEST", target,
                "requestId=" + id + " daily=" + req.getRequestedDailyLimitGhs()
                        + " single=" + req.getRequestedSingleTransactionLimitGhs());

        return ResponseEntity.ok(ApiResponse.success(req));
    }

    @PostMapping("/{id}/deny")
    @Transactional
    public ResponseEntity<ApiResponse<LimitIncreaseRequest>> deny(
            @PathVariable UUID id,
            @RequestBody ReviewRequest body,
            @AuthenticationPrincipal User admin) {
        LimitIncreaseRequest req = requestRepo.findById(id)
                .orElseThrow(() -> new AppException("Request not found"));
        if (req.getStatus() != LimitIncreaseRequest.Status.PENDING) {
            throw new AppException("Request has already been reviewed");
        }

        User target = userRepository.findById(req.getUserId()).orElse(null);

        req.setStatus(LimitIncreaseRequest.Status.DENIED);
        req.setAdminNotes(body.getNotes());
        req.setReviewedBy(admin.getId());
        req.setReviewedAt(LocalDateTime.now());
        requestRepo.save(req);

        if (target != null) {
            notificationService.sendNotification(
                    target.getId(),
                    Notification.NotificationType.SYSTEM_BROADCAST,
                    "Limit increase request update",
                    "Your request for higher limits was not approved at this time. "
                            + (body.getNotes() != null && !body.getNotes().isBlank()
                            ? body.getNotes() : "Please contact support for more details."),
                    null, null);
            auditService.log(admin, "DENY_LIMIT_REQUEST", target, "requestId=" + id);
        }

        return ResponseEntity.ok(ApiResponse.success(req));
    }

    private String buildBody(boolean dailyUp, BigDecimal newDaily, boolean singleUp, BigDecimal newSingle) {
        if (dailyUp && singleUp)
            return "Your daily limit is now GHS " + newDaily.toPlainString()
                    + " and your single-transaction limit is now GHS " + newSingle.toPlainString() + ".";
        if (dailyUp)
            return "Your daily transfer limit has been increased to GHS " + newDaily.toPlainString() + ".";
        return "Your single-transaction limit has been increased to GHS " + newSingle.toPlainString() + ".";
    }

    @Data
    static class ReviewRequest {
        private String notes;
    }
}
