package com.aza.backend.controller;

import io.swagger.v3.oas.annotations.tags.Tag;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.merchant.CreatePlanRequest;
import com.aza.backend.dto.merchant.PlanResponse;
import com.aza.backend.dto.merchant.SubscriptionResponse;
import com.aza.backend.dto.merchant.UpdatePlanRequest;
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

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/merchant/plans")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Merchant Plans", description = "Subscription plans")
public class MerchantPlanController {

    private final MerchantPlanRepository planRepository;
    private final MerchantSubscriptionRepository subscriptionRepository;
    private final MerchantRepository merchantRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<List<PlanResponse>>> listPlans(
            @AuthenticationPrincipal User user) {
        Merchant merchant = requireMerchant(user.getId());
        List<PlanResponse> plans = planRepository
                .findAllByMerchantIdOrderByCreatedAtDesc(merchant.getId())
                .stream()
                .map(this::toPlanResponse)
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success(plans));
    }

    @PostMapping
    @Transactional
    public ResponseEntity<ApiResponse<PlanResponse>> createPlan(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody CreatePlanRequest request) {
        Merchant merchant = requireMerchant(user.getId());

        MerchantPlan.PlanInterval interval;
        try {
            interval = MerchantPlan.PlanInterval.valueOf(request.getInterval().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new AppException("INVALID_INTERVAL",
                    "Interval must be DAILY, WEEKLY, MONTHLY, QUARTERLY, or ANNUALLY", HttpStatus.BAD_REQUEST);
        }

        MerchantPlan plan = MerchantPlan.builder()
                .merchantId(merchant.getId())
                .name(request.getName().trim())
                .description(request.getDescription())
                .amount(request.getAmount())
                .interval(interval)
                .isActive(true)
                .build();

        planRepository.save(plan);
        log.info("Plan created: id={}, merchantId={}, name={}", plan.getId(), merchant.getId(), plan.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(toPlanResponse(plan)));
    }

    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<ApiResponse<PlanResponse>> updatePlan(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id,
            @RequestBody UpdatePlanRequest request) {
        Merchant merchant = requireMerchant(user.getId());
        MerchantPlan plan = planRepository.findByIdAndMerchantId(id, merchant.getId())
                .orElseThrow(() -> new AppException("NOT_FOUND", "Plan not found", HttpStatus.NOT_FOUND));

        if (request.getName() != null && !request.getName().isBlank()) {
            plan.setName(request.getName().trim());
        }
        if (request.getDescription() != null) {
            plan.setDescription(request.getDescription());
        }
        if (request.getAmount() != null) {
            plan.setAmount(request.getAmount());
        }
        if (request.getInterval() != null && !request.getInterval().isBlank()) {
            try {
                plan.setInterval(MerchantPlan.PlanInterval.valueOf(request.getInterval().toUpperCase()));
            } catch (IllegalArgumentException e) {
                throw new AppException("INVALID_INTERVAL",
                        "Interval must be DAILY, WEEKLY, MONTHLY, QUARTERLY, or ANNUALLY", HttpStatus.BAD_REQUEST);
            }
        }

        planRepository.save(plan);
        return ResponseEntity.ok(ApiResponse.success(toPlanResponse(plan)));
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<ApiResponse<Void>> deactivatePlan(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id) {
        Merchant merchant = requireMerchant(user.getId());
        MerchantPlan plan = planRepository.findByIdAndMerchantId(id, merchant.getId())
                .orElseThrow(() -> new AppException("NOT_FOUND", "Plan not found", HttpStatus.NOT_FOUND));
        plan.setActive(false);
        planRepository.save(plan);
        log.info("Plan deactivated: id={}, merchantId={}", id, merchant.getId());
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @GetMapping("/{id}/subscriptions")
    public ResponseEntity<ApiResponse<Page<SubscriptionResponse>>> listPlanSubscriptions(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Merchant merchant = requireMerchant(user.getId());
        // Verify plan belongs to merchant
        planRepository.findByIdAndMerchantId(id, merchant.getId())
                .orElseThrow(() -> new AppException("NOT_FOUND", "Plan not found", HttpStatus.NOT_FOUND));
        Page<SubscriptionResponse> subs = subscriptionRepository
                .findAllByPlanIdOrderByCreatedAtDesc(id, PageRequest.of(page, Math.min(size, 50)))
                .map(this::toSubscriptionResponse);
        return ResponseEntity.ok(ApiResponse.success(subs));
    }

    // ==================== HELPERS ====================

    private Merchant requireMerchant(UUID userId) {
        return merchantRepository.findByUserId(userId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "No merchant account found", HttpStatus.NOT_FOUND));
    }

    private PlanResponse toPlanResponse(MerchantPlan p) {
        return PlanResponse.builder()
                .id(p.getId().toString())
                .name(p.getName())
                .description(p.getDescription())
                .amount(p.getAmount())
                .currency(p.getCurrency())
                .interval(p.getInterval().name())
                .active(p.isActive())
                .createdAt(p.getCreatedAt())
                .build();
    }

    private SubscriptionResponse toSubscriptionResponse(MerchantSubscription s) {
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
