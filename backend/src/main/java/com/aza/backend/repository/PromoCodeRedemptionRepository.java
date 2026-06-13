package com.aza.backend.repository;

import com.aza.backend.entity.PromoCodeRedemption;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PromoCodeRedemptionRepository extends JpaRepository<PromoCodeRedemption, UUID> {

    long countByPromoCodeId(UUID promoCodeId);

    boolean existsByPromoCodeIdAndUserId(UUID promoCodeId, UUID userId);

    List<PromoCodeRedemption> findAllByPromoCodeIdOrderByRedeemedAtDesc(UUID promoCodeId);
}
