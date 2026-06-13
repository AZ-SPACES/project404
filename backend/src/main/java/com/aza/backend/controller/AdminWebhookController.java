package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.entity.WebhookDelivery;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.WebhookDeliveryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/webhooks")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminWebhookController {

    private final WebhookDeliveryRepository webhookDeliveryRepository;

    @GetMapping("/deliveries")
    public ResponseEntity<ApiResponse<Page<WebhookDelivery>>> deliveries(
            @RequestParam(required = false, defaultValue = "FAILED") String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        WebhookDelivery.DeliveryStatus deliveryStatus = WebhookDelivery.DeliveryStatus.valueOf(status.toUpperCase());
        Page<WebhookDelivery> result = webhookDeliveryRepository.findByStatusOrderByLastAttemptAtDesc(
                deliveryStatus, PageRequest.of(page, Math.min(size, 50)));
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<Map<String, Long>>> stats() {
        long pending = webhookDeliveryRepository.countByStatus(WebhookDelivery.DeliveryStatus.PENDING);
        long failed = webhookDeliveryRepository.countByStatus(WebhookDelivery.DeliveryStatus.FAILED);
        long abandoned = webhookDeliveryRepository.countByStatus(WebhookDelivery.DeliveryStatus.ABANDONED);
        long success = webhookDeliveryRepository.countByStatus(WebhookDelivery.DeliveryStatus.SUCCESS);
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "pending", pending,
                "failed", failed,
                "abandoned", abandoned,
                "success", success
        )));
    }

    @PostMapping("/deliveries/{id}/retry")
    public ResponseEntity<ApiResponse<WebhookDelivery>> retry(@PathVariable UUID id) {
        WebhookDelivery delivery = webhookDeliveryRepository.findById(id)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Webhook delivery not found", HttpStatus.NOT_FOUND));
        delivery.setStatus(WebhookDelivery.DeliveryStatus.PENDING);
        delivery.setAttemptCount(delivery.getAttemptCount() + 1);
        delivery.setNextRetryAt(LocalDateTime.now());
        return ResponseEntity.ok(ApiResponse.success(webhookDeliveryRepository.save(delivery)));
    }
}
