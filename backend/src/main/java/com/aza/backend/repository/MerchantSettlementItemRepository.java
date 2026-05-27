package com.aza.backend.repository;

import com.aza.backend.entity.MerchantSettlementItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface MerchantSettlementItemRepository extends JpaRepository<MerchantSettlementItem, UUID> {

    List<MerchantSettlementItem> findAllBySettlementId(UUID settlementId);
}
