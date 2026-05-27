package com.aza.backend.repository;

import com.aza.backend.entity.BulkTransfer;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface BulkTransferRepository extends JpaRepository<BulkTransfer, UUID> {

    Page<BulkTransfer> findAllByMerchantIdOrderByCreatedAtDesc(UUID merchantId, Pageable pageable);

    Optional<BulkTransfer> findByIdAndMerchantId(UUID id, UUID merchantId);
}
