package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.merchant.CreateSubscriptionRequest;
import com.aza.backend.dto.merchant.SubscriptionResponse;
import com.aza.backend.entity.Merchant;
import com.aza.backend.entity.MerchantPlan;
import com.aza.backend.entity.MerchantSubscription;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.MerchantPlanRepository;
import com.aza.backend.repository.MerchantRepository;
import com.aza.backend.repository.MerchantSubscriptionRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/merchant/subscriptions")
@RequiredArgsConstructor
@Slf4j
public class MerchantSubscriptionController {

    private final MerchantSubscriptionRepository subscriptionRepository;
    private final MerchantPlanRepository planRepository;
    private final MerchantRepository merchantRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<Page<SubscriptionResponse>>> listSubscriptions(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Merchant merchant = requireMerchant(user.getId());
        Page<SubscriptionResponse> subs = subscriptionRepository
                .findAllByMerchantIdOrderByCreatedAtDesc(merchant.getId(), PageRequest.of(page, Math.min(size, 50)))
                .map(this::toResponse);
        return ResponseEntity.ok(ApiResponse.success(subs));
    }

    @PostMapping
    @Transactional
    public ResponseEntity<ApiResponse<SubscriptionResponse>> createSubscription(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody CreateSubscriptionRequest request) {
        Merchant merchant = requireMerchant(user.getId());

        MerchantPlan plan = planRepository.findByIdAndMerchantId(request.getPlanId(), merchant.getId())
                .orElseThrow(() -> new AppException("NOT_FOUND", "Plan not found", HttpStatus.NOT_FOUND));

        if (!plan.isActive()) {
            throw new AppException("PLAN_INACTIVE", "Cannot subscribe to an inactive plan", HttpStatus.BAD_REQUEST);
        }

        UUID customerId = null;
        if (request.getCustomerId() != null && !request.getCustomerId().isBlank()) {
            try {
                customerId = UUID.fromString(request.getCustomerId());
            } catch (IllegalArgumentException e) {
                throw new AppException("INVALID_CUSTOMER_ID", "Invalid customer ID format", HttpStatus.BAD_REQUEST);
            }
        }

        LocalDateTime nextBillingAt = computeNextBillingAt(plan.getInterval());

        MerchantSubscription subscription = MerchantSubscription.builder()
                .planId(plan.getId())
                .merchantId(merchant.getId())
                .customerId(customerId)
                .customerName(request.getCustomerName().trim())
                .customerEmail(request.getCustomerEmail())
                .status(MerchantSubscription.SubscriptionStatus.ACTIVE)
                .nextBillingAt(nextBillingAt)
                .build();

        subscriptionRepository.save(subscription);
        log.info("Subscription created: id={}, merchantId={}, planId={}", subscription.getId(), merchant.getId(), plan.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(toResponse(subscription)));
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<ApiResponse<Void>> cancelSubscription(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id) {
        Merchant merchant = requireMerchant(user.getId());
        MerchantSubscription subscription = subscriptionRepository.findByIdAndMerchantId(id, merchant.getId())
                .orElseThrow(() -> new AppException("NOT_FOUND", "Subscription not found", HttpStatus.NOT_FOUND));

        if (subscription.getStatus() == MerchantSubscription.SubscriptionStatus.CANCELLED) {
            throw new AppException("ALREADY_CANCELLED", "Subscription is already cancelled", HttpStatus.BAD_REQUEST);
        }

        subscription.setStatus(MerchantSubscription.SubscriptionStatus.CANCELLED);
        subscription.setCancelledAt(LocalDateTime.now());
        subscriptionRepository.save(subscription);
        log.info("Subscription cancelled: id={}, merchantId={}", id, merchant.getId());
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    // ==================== HELPERS ====================

    private Merchant requireMerchant(UUID userId) {
        return merchantRepository.findByUserId(userId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "No merchant account found", HttpStatus.NOT_FOUND));
    }

    private LocalDateTime computeNextBillingAt(MerchantPlan.PlanInterval interval) {
        LocalDateTime now = LocalDateTime.now();
        return switch (interval) {
            case DAILY -> now.plusDays(1);
            case WEEKLY -> now.plusWeeks(1);
            case MONTHLY -> now.plusMonths(1);
            case QUARTERLY -> now.plusMonths(3);
            case ANNUALLY -> now.plusYears(1);
        };
    }

    private SubscriptionResponse toResponse(MerchantSubscription s) {
        return SubscriptionResponse.builder()
                .id(s.getId().toString())
                .planId(s.getPlanId().toString())
                .merchantId(s.getMerchantId().toString())
                .customerId(s.getCustomerId() != null ? s.getCustomerId().toString() : null)
                .customerName(s.getCustomerName())
                .customerEmail(s.getCustomerEmail())
                .status(s.getStatus().name())
                .nextBillingAt(s.getNextBillingAt())
                .createdAt(s.getCreatedAt())
                .cancelledAt(s.getCancelledAt())
                .build();
    }
}
