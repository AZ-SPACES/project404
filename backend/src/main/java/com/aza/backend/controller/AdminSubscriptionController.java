package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.entity.MerchantSubscription;
import com.aza.backend.entity.User;
import com.aza.backend.repository.MerchantSubscriptionRepository;
import com.aza.backend.service.AdminAuditService;
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
@RequestMapping("/api/v1/admin/subscriptions")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','FINANCE')")
public class AdminSubscriptionController {

    private final MerchantSubscriptionRepository subscriptionRepo;
    private final AdminAuditService auditService;

    @GetMapping
    public ResponseEntity<ApiResponse<Page<MerchantSubscription>>> list(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageRequest pr = PageRequest.of(page, Math.min(size, 50),
                Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<MerchantSubscription> result = status != null && !status.isBlank()
                ? subscriptionRepo.findAllByStatusOrderByCreatedAtDesc(
                        MerchantSubscription.SubscriptionStatus.valueOf(status.toUpperCase()), pr)
                : subscriptionRepo.findAll(pr);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PatchMapping("/{id}/cancel")
    public ResponseEntity<ApiResponse<MerchantSubscription>> cancel(
            @PathVariable UUID id,
            @AuthenticationPrincipal User admin) {
        MerchantSubscription sub = subscriptionRepo.findById(id)
                .orElseThrow(() -> new com.aza.backend.exception.AppException("Subscription not found"));
        sub.setStatus(MerchantSubscription.SubscriptionStatus.CANCELLED);
        sub.setCancelledAt(java.time.LocalDateTime.now());
        subscriptionRepo.save(sub);
        auditService.log(admin, "CANCEL_SUBSCRIPTION", null,
                "id=" + id + " merchant=" + sub.getMerchantId());
        return ResponseEntity.ok(ApiResponse.success(sub));
    }
}
