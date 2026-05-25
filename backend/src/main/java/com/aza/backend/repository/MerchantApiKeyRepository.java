package com.aza.backend.repository;

import com.aza.backend.entity.MerchantApiKey;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MerchantApiKeyRepository extends JpaRepository<MerchantApiKey, UUID> {

    List<MerchantApiKey> findAllByMerchantIdOrderByCreatedAtDesc(UUID merchantId);

    Optional<MerchantApiKey> findByKeyHashAndIsActiveTrue(String keyHash);
}
