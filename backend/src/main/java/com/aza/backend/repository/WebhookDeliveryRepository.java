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

    /**
     * One row per (event type, status) with its count, for the delivery dashboard.
     *
     * <p>The dashboard used to load every delivery ever recorded and count them in Java.
     * Deliveries are an append-only table that grows with traffic, so that was an
     * out-of-memory failure waiting on volume. The database already knows how to count.
     */
    @Query("SELECT d.eventType, d.status, COUNT(d) FROM WebhookDelivery d GROUP BY d.eventType, d.status")
    List<Object[]> countByEventTypeAndStatus();

    /** Mean attempts across all deliveries, computed in the database. */
    @Query("SELECT COALESCE(AVG(d.attemptCount), 0) FROM WebhookDelivery d")
    Double averageAttemptCount();

    @Query("SELECT d.endpointId, COUNT(d) FROM WebhookDelivery d WHERE d.status IN ('FAILED','ABANDONED') AND d.endpointId IN :endpointIds GROUP BY d.endpointId")
    List<Object[]> countFailedByEndpointIds(@Param("endpointIds") List<UUID> endpointIds);
}
