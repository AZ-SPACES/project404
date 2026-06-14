package com.aza.backend.service;

import com.aza.backend.entity.WebhookDelivery;
import com.aza.backend.entity.WebhookEndpoint;
import com.aza.backend.repository.WebhookDeliveryRepository;
import com.aza.backend.repository.WebhookEndpointRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.InetAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class WebhookService {

    private final WebhookDeliveryRepository deliveryRepository;
    private final WebhookEndpointRepository endpointRepository;

    // Retry delays in seconds: 5s, 30s, 5m, 30m, 2h, 6h, 24h
    private static final long[] RETRY_DELAYS_SECONDS = {5, 30, 300, 1800, 7200, 21600, 86400};
    private static final int MAX_ATTEMPTS = RETRY_DELAYS_SECONDS.length;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    @Scheduled(fixedDelay = 10_000) // every 10 seconds
    public void processQueue() {
        List<WebhookDelivery> pending = deliveryRepository.findAllByStatusAndNextRetryAtBefore(
                WebhookDelivery.DeliveryStatus.PENDING, LocalDateTime.now());

        for (WebhookDelivery delivery : pending) {
            deliver(delivery);
        }
    }

    /**
     * Blocks webhook delivery to loopback/private/link-local addresses to prevent SSRF.
     * Called at delivery time so that DNS rebinding attacks during registration are also caught.
     */
    private void validateWebhookUrl(String urlString) {
        try {
            URI uri = URI.create(urlString);
            if (!"https".equalsIgnoreCase(uri.getScheme())) {
                throw new com.aza.backend.exception.AppException("Webhook URLs must use HTTPS");
            }
            InetAddress addr = InetAddress.getByName(uri.getHost());
            if (addr.isLoopbackAddress() || addr.isSiteLocalAddress()
                    || addr.isLinkLocalAddress() || addr.isAnyLocalAddress()) {
                throw new com.aza.backend.exception.AppException(
                        "Webhook URL resolves to a private/internal address");
            }
        } catch (java.net.UnknownHostException e) {
            throw new com.aza.backend.exception.AppException(
                    "Cannot resolve webhook host: " + e.getMessage());
        }
    }

    private void deliver(WebhookDelivery delivery) {
        WebhookEndpoint endpoint = endpointRepository.findById(delivery.getEndpointId()).orElse(null);
        if (endpoint == null || !Boolean.TRUE.equals(endpoint.getIsActive())) {
            delivery.setStatus(WebhookDelivery.DeliveryStatus.ABANDONED);
            deliveryRepository.save(delivery);
            return;
        }

        delivery.setAttemptCount(delivery.getAttemptCount() + 1);
        delivery.setLastAttemptAt(LocalDateTime.now());

        try {
            validateWebhookUrl(endpoint.getUrl());
            String signature = hmacSha256(delivery.getPayload(), endpoint.getSigningSecret());

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint.getUrl()))
                    .header("Content-Type", "application/json")
                    .header("X-Aza-Signature", "sha256=" + signature)
                    .header("X-Aza-Event", delivery.getEventType())
                    .header("X-Aza-Delivery", delivery.getId().toString())
                    .POST(HttpRequest.BodyPublishers.ofString(delivery.getPayload()))
                    .timeout(Duration.ofSeconds(15))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            delivery.setResponseStatusCode(response.statusCode());
            delivery.setResponseBody(response.body() != null
                    ? response.body().substring(0, Math.min(response.body().length(), 500)) : null);

            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                delivery.setStatus(WebhookDelivery.DeliveryStatus.SUCCESS);
                log.info("Webhook delivered: deliveryId={}, status={}", delivery.getId(), response.statusCode());
            } else {
                scheduleRetry(delivery);
            }
        } catch (Exception e) {
            log.warn("Webhook delivery failed: deliveryId={}, attempt={}, error={}", delivery.getId(), delivery.getAttemptCount(), e.getMessage());
            scheduleRetry(delivery);
        }

        deliveryRepository.save(delivery);
    }

    private void scheduleRetry(WebhookDelivery delivery) {
        int attempt = delivery.getAttemptCount();
        if (attempt >= MAX_ATTEMPTS) {
            delivery.setStatus(WebhookDelivery.DeliveryStatus.ABANDONED);
            log.warn("Webhook abandoned after {} attempts: deliveryId={}", attempt, delivery.getId());
        } else {
            long delaySeconds = RETRY_DELAYS_SECONDS[Math.min(attempt, RETRY_DELAYS_SECONDS.length - 1)];
            delivery.setNextRetryAt(LocalDateTime.now().plusSeconds(delaySeconds));
            delivery.setStatus(WebhookDelivery.DeliveryStatus.PENDING);
        }
    }

    private String hmacSha256(String payload, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        SecretKeySpec keySpec = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        mac.init(keySpec);
        byte[] hash = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
        return HexFormat.of().formatHex(hash);
    }
}
