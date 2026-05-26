package com.aza.backend.repository;

import com.aza.backend.entity.KybRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface KybRecordRepository extends JpaRepository<KybRecord, UUID> {

    Optional<KybRecord> findByMerchantId(UUID merchantId);

    List<KybRecord> findAllByStatus(KybRecord.KybStatus status);
}
