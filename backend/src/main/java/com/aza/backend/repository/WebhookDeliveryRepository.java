package com.aza.backend.repository;

import com.aza.backend.entity.WebhookDelivery;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface WebhookDeliveryRepository extends JpaRepository<WebhookDelivery, UUID> {

    List<WebhookDelivery> findAllByStatusAndNextRetryAtBefore(
            WebhookDelivery.DeliveryStatus status, LocalDateTime now);
    List<WebhookDelivery> findAllByEndpointIdOrderByCreatedAtDesc(UUID endpointId);

    Page<WebhookDelivery> findAllByEndpointIdInOrderByCreatedAtDesc(List<UUID> endpointIds, Pageable pageable);

    Page<WebhookDelivery> findByStatusOrderByLastAttemptAtDesc(WebhookDelivery.DeliveryStatus status, Pageable pageable);

    long countByStatus(WebhookDelivery.DeliveryStatus status);

    @Query("SELECT d.endpointId, COUNT(d) FROM WebhookDelivery d WHERE d.status IN ('FAILED','ABANDONED') AND d.endpointId IN :endpointIds GROUP BY d.endpointId")
    List<Object[]> countFailedByEndpointIds(@Param("endpointIds") List<UUID> endpointIds);
}
