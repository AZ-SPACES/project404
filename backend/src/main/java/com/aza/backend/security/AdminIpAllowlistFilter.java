package com.aza.backend.security;

import com.aza.backend.security.fingerprint.RequestFingerprintService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;

/**
 * Optional network-level gate for the admin console. When app.admin.allowed-ips
 * is set (comma-separated; exact IPs or prefixes ending in '.'), /api/v1/admin/**
 * is only reachable from those addresses. Empty (the default) disables the gate
 * so nothing breaks before an office IP is known.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AdminIpAllowlistFilter extends OncePerRequestFilter {

    private final RequestFingerprintService fingerprintService;

    @Value("${app.admin.allowed-ips:}")
    private String allowedIps;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        if (!request.getRequestURI().startsWith("/api/v1/admin")
                || allowedIps == null || allowedIps.isBlank()) {
            filterChain.doFilter(request, response);
            return;
        }

        String clientIp = fingerprintService.getClientIp(request);
        List<String> allowed = Arrays.stream(allowedIps.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
        boolean permitted = allowed.stream().anyMatch(entry ->
                entry.endsWith(".") ? clientIp.startsWith(entry) : clientIp.equals(entry));

        if (permitted) {
            filterChain.doFilter(request, response);
            return;
        }

        log.warn("Admin console request from non-allowlisted IP {} blocked ({} {})",
                clientIp, request.getMethod(), request.getRequestURI());
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json");
        response.getWriter().write(
                "{\"success\":false,\"error\":{\"code\":\"IP_NOT_ALLOWED\"," +
                "\"message\":\"The admin console is not available from this network\"}}");
    }
}
