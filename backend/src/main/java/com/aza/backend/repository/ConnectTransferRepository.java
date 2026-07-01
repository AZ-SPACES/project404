package com.aza.backend.repository;

import com.aza.backend.entity.ConnectTransfer;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ConnectTransferRepository extends JpaRepository<ConnectTransfer, UUID> {

    Optional<ConnectTransfer> findByMerchantIdAndIdempotencyKey(UUID merchantId, String idempotencyKey);

    Optional<ConnectTransfer> findByIdAndMerchantId(UUID id, UUID merchantId);

    Page<ConnectTransfer> findAllByMerchantIdOrderByCreatedAtDesc(UUID merchantId, Pageable pageable);
}
