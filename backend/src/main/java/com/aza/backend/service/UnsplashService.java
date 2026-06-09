package com.aza.backend.service;

import com.aza.backend.dto.UnsplashPhoto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class UnsplashService {

    private final ObjectMapper objectMapper;

    @Value("${unsplash.access-key:}")
    private String accessKey;

    private static final String BASE_URL = "https://api.unsplash.com";

    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(8))
            .build();

    public List<UnsplashPhoto> search(String query, int page, int perPage) {
        if (accessKey == null || accessKey.isBlank()) {
            log.warn("Unsplash access key not configured");
            return List.of();
        }
        try {
            String encoded = URLEncoder.encode(query.trim(), StandardCharsets.UTF_8);
            String url = String.format("%s/search/photos?query=%s&page=%d&per_page=%d",
                    BASE_URL, encoded, page, perPage);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Authorization", "Client-ID " + accessKey)
                    .header("Accept-Version", "v1")
                    .GET()
                    .timeout(Duration.ofSeconds(10))
                    .build();

            HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                log.error("Unsplash search failed: HTTP {}", response.statusCode());
                return List.of();
            }

            JsonNode root = objectMapper.readTree(response.body());
            JsonNode results = root.get("results");
            if (results == null || !results.isArray()) return List.of();

            List<UnsplashPhoto> photos = new ArrayList<>();
            for (JsonNode item : results) {
                String id = item.path("id").asText(null);
                String thumbUrl = item.path("urls").path("small").asText(null);
                String regularUrl = item.path("urls").path("regular").asText(null);
                String photographerName = item.path("user").path("name").asText("Unknown");
                String photographerUrl = item.path("user").path("links").path("html").asText(null);
                String downloadLocation = item.path("links").path("download_location").asText(null);

                if (id != null && thumbUrl != null && regularUrl != null) {
                    photos.add(new UnsplashPhoto(id, thumbUrl, regularUrl,
                            photographerName, photographerUrl, downloadLocation));
                }
            }
            return photos;
        } catch (Exception e) {
            log.error("Unsplash search error: {}", e.getMessage());
            return List.of();
        }
    }

    /** Must be called when the user actually applies a photo — required by Unsplash API guidelines. */
    public void triggerDownload(String downloadLocation) {
        if (accessKey == null || accessKey.isBlank() || downloadLocation == null || downloadLocation.isBlank()) return;
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(downloadLocation))
                    .header("Authorization", "Client-ID " + accessKey)
                    .header("Accept-Version", "v1")
                    .GET()
                    .timeout(Duration.ofSeconds(5))
                    .build();
            HTTP_CLIENT.sendAsync(request, HttpResponse.BodyHandlers.discarding());
        } catch (Exception e) {
            log.warn("Failed to trigger Unsplash download event: {}", e.getMessage());
        }
    }
}
