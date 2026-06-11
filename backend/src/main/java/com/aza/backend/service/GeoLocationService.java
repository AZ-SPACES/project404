package com.aza.backend.service;

import com.aza.backend.repository.RefreshTokenRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.UUID;

/**
 * Resolves a session's IP address into a human-readable "City, Country" label and stores it
 * on the {@link com.aza.backend.entity.RefreshToken}. Runs off the auth critical path so the
 * external lookup never adds latency to login or token refresh. Best-effort: failures are logged
 * and the location simply stays null.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GeoLocationService {

    private final RefreshTokenRepository refreshTokenRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    @Async("taskExecutor")
    public void resolveAndStore(UUID refreshTokenId, String ip) {
        String location = resolve(ip);
        if (location == null) return;
        try {
            refreshTokenRepository.updateLocation(refreshTokenId, location);
        } catch (Exception e) {
            log.warn("Failed to persist location for session {}: {}", refreshTokenId, e.getMessage());
        }
    }

    /** Returns a short "City, Country" label, or null when it can't be determined. */
    private String resolve(String ip) {
        if (ip == null || ip.isBlank() || ip.equals("127.0.0.1") || ip.equals("0:0:0:0:0:0:0:1")) {
            return null;
        }
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://ip-api.com/json/" + ip + "?fields=status,country,city"))
                    .timeout(Duration.ofSeconds(5))
                    .GET().build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                JsonNode node = objectMapper.readTree(response.body());
                if ("success".equals(node.path("status").asText())) {
                    String city    = node.path("city").asText("");
                    String country = node.path("country").asText("");
                    StringBuilder sb = new StringBuilder();
                    if (!city.isBlank()) sb.append(city);
                    if (!country.isBlank()) {
                        if (sb.length() > 0) sb.append(", ");
                        sb.append(country);
                    }
                    return sb.length() > 0 ? sb.toString() : null;
                }
            }
        } catch (Exception e) {
            log.warn("Failed to resolve location for IP {}: {}", ip, e.getMessage());
        }
        return null;
    }
}
