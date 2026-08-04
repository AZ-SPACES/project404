package com.aza.backend.repository;

import com.aza.backend.entity.MandateCharge;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface MandateChargeRepository extends JpaRepository<MandateCharge, UUID> {

    Optional<MandateCharge> findByMerchantIdAndIdempotencyKey(UUID merchantId, String idempotencyKey);

    Page<MandateCharge> findAllByMandateIdOrderByCreatedAtDesc(UUID mandateId, Pageable pageable);
}
