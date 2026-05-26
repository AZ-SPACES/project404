package com.aza.backend.repository;

import com.aza.backend.entity.MerchantInvoice;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface MerchantInvoiceRepository extends JpaRepository<MerchantInvoice, UUID> {
    Page<MerchantInvoice> findAllByMerchantIdOrderByCreatedAtDesc(UUID merchantId, Pageable pageable);
    Optional<MerchantInvoice> findByIdAndMerchantId(UUID id, UUID merchantId);
    long countByMerchantId(UUID merchantId);
}
