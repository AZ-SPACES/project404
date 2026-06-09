package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.UnsplashPhoto;
import com.aza.backend.service.UnsplashService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/unsplash")
@RequiredArgsConstructor
public class UnsplashController {

    private final UnsplashService unsplashService;

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<List<UnsplashPhoto>>> search(
            @RequestParam String query,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int perPage) {

        if (query == null || query.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("INVALID_REQUEST", "query is required"));
        }
        int safePerPage = Math.min(Math.max(perPage, 1), 30);
        List<UnsplashPhoto> results = unsplashService.search(query, page, safePerPage);
        return ResponseEntity.ok(ApiResponse.success(results));
    }

    @PostMapping("/trigger-download")
    public ResponseEntity<ApiResponse<Void>> triggerDownload(
            @RequestBody Map<String, String> body) {
        String downloadLocation = body.get("downloadLocation");
        if (downloadLocation != null && !downloadLocation.isBlank()) {
            unsplashService.triggerDownload(downloadLocation);
        }
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
