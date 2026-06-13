package com.aza.backend.repository;

import com.aza.backend.entity.MerchantSubscription;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface MerchantSubscriptionRepository extends JpaRepository<MerchantSubscription, UUID> {
    Page<MerchantSubscription> findAllByMerchantIdOrderByCreatedAtDesc(UUID merchantId, Pageable pageable);
    Page<MerchantSubscription> findAllByStatusOrderByCreatedAtDesc(MerchantSubscription.SubscriptionStatus status, Pageable pageable);
    Page<MerchantSubscription> findAllByPlanIdOrderByCreatedAtDesc(UUID planId, Pageable pageable);
    Optional<MerchantSubscription> findByIdAndMerchantId(UUID id, UUID merchantId);
}
