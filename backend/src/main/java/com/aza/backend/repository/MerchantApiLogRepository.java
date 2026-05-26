package com.aza.backend.repository;

import com.aza.backend.entity.MerchantApiLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface MerchantApiLogRepository extends JpaRepository<MerchantApiLog, UUID> {

    Page<MerchantApiLog> findAllByMerchantIdOrderByCreatedAtDesc(UUID merchantId, Pageable pageable);
}
