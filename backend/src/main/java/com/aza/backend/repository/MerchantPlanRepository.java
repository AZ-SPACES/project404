package com.aza.backend.repository;

import com.aza.backend.entity.MerchantPlan;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MerchantPlanRepository extends JpaRepository<MerchantPlan, UUID> {
    List<MerchantPlan> findAllByMerchantIdOrderByCreatedAtDesc(UUID merchantId);
    Optional<MerchantPlan> findByIdAndMerchantId(UUID id, UUID merchantId);
    boolean existsByMerchantIdAndName(UUID merchantId, String name);
}
