package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.entity.RateLimitConfig;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.RateLimitConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/rate-limits")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminRateLimitController {

    private final RateLimitConfigRepository rateLimitConfigRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<List<RateLimitConfig>>> listAll() {
        return ResponseEntity.ok(ApiResponse.success(
                rateLimitConfigRepository.findAllByOrderByCreatedAtDesc()));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<RateLimitConfig>> create(@RequestBody RateLimitConfigRequest body) {
        RateLimitConfig config = RateLimitConfig.builder()
                .endpointPattern(body.endpointPattern())
                .description(body.description())
                .maxRequests(body.maxRequests())
                .windowSeconds(body.windowSeconds())
                .scope(body.scope())
                .enabled(body.enabled() != null ? body.enabled() : true)
                .build();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(rateLimitConfigRepository.save(config)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<RateLimitConfig>> update(
            @PathVariable UUID id,
            @RequestBody RateLimitConfigRequest body) {
        RateLimitConfig config = rateLimitConfigRepository.findById(id)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Rate limit config not found", HttpStatus.NOT_FOUND));
        config.setEndpointPattern(body.endpointPattern());
        config.setDescription(body.description());
        config.setMaxRequests(body.maxRequests());
        config.setWindowSeconds(body.windowSeconds());
        config.setScope(body.scope());
        if (body.enabled() != null) config.setEnabled(body.enabled());
        return ResponseEntity.ok(ApiResponse.success(rateLimitConfigRepository.save(config)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id) {
        if (!rateLimitConfigRepository.existsById(id)) {
            throw new AppException("NOT_FOUND", "Rate limit config not found", HttpStatus.NOT_FOUND);
        }
        rateLimitConfigRepository.deleteById(id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/{id}/toggle")
    public ResponseEntity<ApiResponse<RateLimitConfig>> toggle(@PathVariable UUID id) {
        RateLimitConfig config = rateLimitConfigRepository.findById(id)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Rate limit config not found", HttpStatus.NOT_FOUND));
        config.setEnabled(!config.isEnabled());
        return ResponseEntity.ok(ApiResponse.success(rateLimitConfigRepository.save(config)));
    }

    record RateLimitConfigRequest(
            String endpointPattern,
            String description,
            int maxRequests,
            int windowSeconds,
            String scope,
            Boolean enabled
    ) {}
}
