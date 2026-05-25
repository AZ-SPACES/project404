package com.aza.backend.repository;

import com.aza.backend.entity.WebhookEndpoint;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface WebhookEndpointRepository extends JpaRepository<WebhookEndpoint, UUID> {

    List<WebhookEndpoint> findAllByMerchantIdAndIsActiveTrue(UUID merchantId);

    List<WebhookEndpoint> findAllByMerchantId(UUID merchantId);
}
