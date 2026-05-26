package com.aza.backend.repository;

import com.aza.backend.entity.WebhookDelivery;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface WebhookDeliveryRepository extends JpaRepository<WebhookDelivery, UUID> {

    List<WebhookDelivery> findAllByStatusAndNextRetryAtBefore(
            WebhookDelivery.DeliveryStatus status, LocalDateTime now);
}
