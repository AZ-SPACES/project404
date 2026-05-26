package com.aza.backend.service;

import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class WalletService {

    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    @Value("${passkit.api-key}")
    private String apiKey;

    @Value("${passkit.api-secret}")
    private String apiSecret;

    @Value("${passkit.template-id}")
    private String templateId;

    @Value("${app.base-url:https://aza.syste,s}")
    private String baseUrl;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    public String getAppleWalletPassUrl(String handle) {
        User user = userRepository.findByUsername(handle)
                .orElseThrow(() -> new AppException("NOT_FOUND", "User not found", HttpStatus.NOT_FOUND));

        String displayName = trim(
                (user.getFirstName() != null ? user.getFirstName() : "") +
                (user.getLastName() != null ? " " + user.getLastName() : ""));
        String payLink = baseUrl + "/" + handle;

        try {
            // PassKit REST API v4 — dynamicData keys match the field IDs in your template
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("externalId", "aza-" + user.getId());

            Map<String, String> dynamicData = new LinkedHashMap<>();
            dynamicData.put("name", displayName.isEmpty() ? handle : displayName);
            dynamicData.put("handle", "@" + handle);
            dynamicData.put("qr", payLink);
            body.put("dynamicData", dynamicData);

            String credentials = Base64.getEncoder()
                    .encodeToString((apiKey + ":" + apiSecret).getBytes());
            String json = objectMapper.writeValueAsString(body);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.passkit.com/v1/pass/issue/template/" + templateId))
                    .header("Authorization", "Basic " + credentials)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json))
                    .timeout(Duration.ofSeconds(10))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                JsonNode node = objectMapper.readTree(response.body());
                String url = node.path("url").asText(null);
                if (url == null || url.isBlank()) {
                    log.error("PassKit response missing url field: {}", response.body());
                    throw new AppException("WALLET_ERROR", "PassKit returned no pass URL", HttpStatus.BAD_GATEWAY);
                }
                return url;
            } else {
                log.error("PassKit API error {}: {}", response.statusCode(), response.body());
                throw new AppException("WALLET_ERROR", "Failed to generate Apple Wallet pass", HttpStatus.BAD_GATEWAY);
            }
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            log.error("Unexpected error calling PassKit API: {}", e.getMessage());
            throw new AppException("WALLET_ERROR", "Could not generate wallet pass", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    private static String trim(String s) {
        return s == null ? "" : s.trim();
    }
}
