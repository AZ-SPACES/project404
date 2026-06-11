package com.aza.backend.security;

import com.aza.backend.entity.User;
import com.aza.backend.service.AdminStepUpService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Requires a fresh 2FA step-up (AdminStepUpService) for every /api/v1/admin/**
 * request regardless of how the JWT session was obtained. The step-up endpoint
 * itself is exempt — it's how elevation is acquired. Unauthenticated requests
 * pass through; the security rules reject them with 401/403 as usual.
 */
@Component
@RequiredArgsConstructor
public class AdminStepUpFilter extends OncePerRequestFilter {

    private final AdminStepUpService stepUpService;

    private static final String ADMIN_PREFIX = "/api/v1/admin";
    private static final String STEP_UP_PATH = "/api/v1/admin/step-up";

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        String uri = request.getRequestURI();
        if (!uri.startsWith(ADMIN_PREFIX) || uri.startsWith(STEP_UP_PATH)) {
            filterChain.doFilter(request, response);
            return;
        }

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof User user)) {
            filterChain.doFilter(request, response);
            return;
        }

        if (stepUpService.isElevated(user.getId())) {
            stepUpService.refresh(user.getId());
            filterChain.doFilter(request, response);
            return;
        }

        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json");
        response.getWriter().write(
                "{\"success\":false,\"error\":{\"code\":\"STEP_UP_REQUIRED\"," +
                "\"message\":\"Re-verify your identity to access the admin console\"}}");
    }
}
