package com.aza.backend.repository;

import com.aza.backend.entity.MerchantSettlement;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface MerchantSettlementRepository extends JpaRepository<MerchantSettlement, UUID> {

    Page<MerchantSettlement> findAllByMerchantIdOrderByCreatedAtDesc(UUID merchantId, Pageable pageable);

    Optional<MerchantSettlement> findByIdAndMerchantId(UUID id, UUID merchantId);

    @Query("SELECT s FROM MerchantSettlement s WHERE s.merchantId = :merchantId ORDER BY s.periodEnd DESC")
    java.util.List<MerchantSettlement> findTopByMerchantIdOrderByPeriodEndDesc(@Param("merchantId") UUID merchantId, Pageable pageable);
}
