package com.aza.backend.repository;

import com.aza.backend.entity.MerchantDiscountCode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface MerchantDiscountCodeRepository extends JpaRepository<MerchantDiscountCode, UUID> {

    List<MerchantDiscountCode> findByMerchantIdOrderByCreatedAtDesc(UUID merchantId);

    Optional<MerchantDiscountCode> findByCodeAndMerchantIdAndActiveTrue(String code, UUID merchantId);

    Optional<MerchantDiscountCode> findByIdAndMerchantId(UUID id, UUID merchantId);

    boolean existsByCodeAndMerchantId(String code, UUID merchantId);
}
