package com.aza.backend.repository;

import com.aza.backend.entity.MerchantPayout;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface MerchantPayoutRepository extends JpaRepository<MerchantPayout, UUID> {

    Page<MerchantPayout> findAllByMerchantIdOrderByRequestedAtDesc(UUID merchantId, Pageable pageable);
}
