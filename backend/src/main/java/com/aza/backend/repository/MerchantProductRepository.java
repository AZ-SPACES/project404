package com.aza.backend.repository;

import com.aza.backend.entity.MerchantProduct;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface MerchantProductRepository extends JpaRepository<MerchantProduct, UUID> {
    Page<MerchantProduct> findAllByMerchantIdOrderByCreatedAtDesc(UUID merchantId, Pageable pageable);
    Page<MerchantProduct> findAllByMerchantIdAndActiveOrderByCreatedAtDesc(UUID merchantId, boolean active, Pageable pageable);
    Optional<MerchantProduct> findByIdAndMerchantId(UUID id, UUID merchantId);
    boolean existsByMerchantIdAndSku(UUID merchantId, String sku);
}
