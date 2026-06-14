package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.entity.User;
import com.aza.backend.entity.UserWithdrawal;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.UserWithdrawalRepository;
import com.aza.backend.service.NotificationService;
import com.aza.backend.entity.Notification;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/withdrawals")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','SUPPORT')")
public class AdminWithdrawalController {

    private final UserWithdrawalRepository withdrawalRepository;
    private final NotificationService notificationService;

    public record ReviewRequest(String action, String note) {}

    @GetMapping
    public ResponseEntity<ApiResponse<Page<UserWithdrawal>>> list(
            @RequestParam(defaultValue = "") String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<UserWithdrawal> result;
        if (status.isBlank()) {
            result = withdrawalRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(page, size));
        } else {
            var s = UserWithdrawal.WithdrawalStatus.valueOf(status.toUpperCase());
            result = withdrawalRepository.findAllByStatusOrderByCreatedAtDesc(s, PageRequest.of(page, size));
        }
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PostMapping("/{id}/review")
    public ResponseEntity<ApiResponse<UserWithdrawal>> review(
            @PathVariable UUID id,
            @AuthenticationPrincipal User admin,
            @RequestBody ReviewRequest req) {

        var withdrawal = withdrawalRepository.findById(id)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Withdrawal not found", HttpStatus.NOT_FOUND));

        if (withdrawal.getStatus() != UserWithdrawal.WithdrawalStatus.PENDING) {
            throw new AppException("ALREADY_REVIEWED", "This withdrawal has already been reviewed", HttpStatus.BAD_REQUEST);
        }

        UserWithdrawal.WithdrawalStatus newStatus = switch (req.action().toUpperCase()) {
            case "APPROVE" -> UserWithdrawal.WithdrawalStatus.APPROVED;
            case "REJECT" -> UserWithdrawal.WithdrawalStatus.REJECTED;
            default -> throw new AppException("INVALID_ACTION", "action must be APPROVE or REJECT", HttpStatus.BAD_REQUEST);
        };

        withdrawal.setStatus(newStatus);
        withdrawal.setAdminNote(req.note());
        withdrawal.setReviewedAt(LocalDateTime.now());
        withdrawal.setReviewedBy(admin.getId());
        withdrawalRepository.save(withdrawal);

        String title = newStatus == UserWithdrawal.WithdrawalStatus.APPROVED ? "Withdrawal Approved" : "Withdrawal Update";
        String body = newStatus == UserWithdrawal.WithdrawalStatus.APPROVED
                ? "Your withdrawal of GHS " + withdrawal.getAmount() + " has been approved and is being processed."
                : "Your withdrawal of GHS " + withdrawal.getAmount() + " could not be processed. " + (req.note() != null ? req.note() : "Please contact support.");
        notificationService.sendNotification(withdrawal.getUserId(), Notification.NotificationType.SECURITY_ALERT, title, body, null);

        return ResponseEntity.ok(ApiResponse.success(withdrawal));
    }
}
