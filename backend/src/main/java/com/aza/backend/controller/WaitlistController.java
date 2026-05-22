package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.waitlist.WaitlistRequest;
import com.aza.backend.service.WaitlistService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Set;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/v1/waitlist")
@RequiredArgsConstructor
@Slf4j
public class WaitlistController {

    private final WaitlistService waitlistService;

    @Value("${app.waitlist.internal-secret:}")
    private String internalSecret;

    @Value("${app.trusted-proxy-ips:}")
    private String trustedProxyIps;

    private static final Pattern IP_PATTERN =
            Pattern.compile("^(([0-9]{1,3}\\.){3}[0-9]{1,3}|[0-9a-fA-F:]{2,39})$");

    @PostMapping
    public ResponseEntity<ApiResponse<String>> joinWaitlist(
            @RequestHeader(value = "X-Internal-Secret", required = false) String providedSecret,
            @Valid @RequestBody WaitlistRequest request,
            HttpServletRequest httpRequest) {

        if (!isValidSecret(providedSecret)) {
            // Log the remote addr only, never the provided secret
            log.warn("Waitlist: rejected request with invalid secret from {}", httpRequest.getRemoteAddr());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error("UNAUTHORIZED", "Unauthorized"));
        }

        String ipAddress = getClientIp(httpRequest);
        waitlistService.register(request.getEmail(), ipAddress);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("You're on the waitlist!"));
    }

    private boolean isValidSecret(String provided) {
        // Reject immediately if the secret is not configured — never accept unconfigured state
        if (internalSecret == null || internalSecret.isBlank()) {
            log.error("app.waitlist.internal-secret is not configured — waitlist endpoint is locked");
            return false;
        }
        if (provided == null || provided.isBlank()) {
            return false;
        }
        // Constant-time comparison to prevent timing attacks
        return MessageDigest.isEqual(
                internalSecret.getBytes(StandardCharsets.UTF_8),
                provided.getBytes(StandardCharsets.UTF_8)
        );
    }

    private String getClientIp(HttpServletRequest request) {
        String remoteAddr = request.getRemoteAddr();
        if (trustedProxyIps != null && !trustedProxyIps.isBlank()) {
            Set<String> trusted = Set.of(trustedProxyIps.split(","));
            if (trusted.contains(remoteAddr)) {
                String xfHeader = request.getHeader("X-Forwarded-For");
                if (xfHeader != null && !xfHeader.isBlank()) {
                    String candidate = xfHeader.split(",")[0].trim();
                    if (IP_PATTERN.matcher(candidate).matches()) {
                        return candidate;
                    }
                }
            }
        }
        return remoteAddr;
    }
}
