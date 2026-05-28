package com.aza.backend.repository;

import com.aza.backend.entity.MerchantNotificationPreference;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface MerchantNotificationPreferenceRepository extends JpaRepository<MerchantNotificationPreference, UUID> {

    Optional<MerchantNotificationPreference> findByMerchantId(UUID merchantId);

    java.util.List<MerchantNotificationPreference> findByEmailLowBalanceTrue();

    java.util.List<MerchantNotificationPreference> findByEmailWeeklySummaryTrue();
}
