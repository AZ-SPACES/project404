package com.aza.backend.repository;

import com.aza.backend.entity.MerchantAuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface MerchantAuditLogRepository extends JpaRepository<MerchantAuditLog, UUID> {
    Page<MerchantAuditLog> findAllByMerchantIdOrderByTimestampDesc(UUID merchantId, Pageable pageable);
}
