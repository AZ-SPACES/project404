package com.aza.backend.security;

import com.aza.backend.entity.Agent;
import com.aza.backend.entity.User;
import com.aza.backend.repository.AgentRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.service.StaffRoleService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import com.aza.backend.exception.AppException;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;
    private final StringRedisTemplate redisTemplate;
    private final StaffRoleService staffRoleService;
    private final AgentRepository agentRepository;

    private static final String BLACKLIST_PREFIX = "jwt:blacklist:";

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        // 1. Extract token from Authorization header
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(7); // Remove "Bearer "

        // 2. Validate token
        if (jwtUtil.isInvalid(token)) {
            filterChain.doFilter(request, response);
            return;
        }

        if (!"ACCESS".equals(jwtUtil.getTokenType(token))) {
            filterChain.doFilter(request, response);
            return;
        }

        // 3. Check if token is blacklisted (logged out)
        if (Boolean.TRUE.equals(redisTemplate.hasKey(BLACKLIST_PREFIX + hashToken(token)))) {
            filterChain.doFilter(request, response);
            return;
        }

        // 4. Extract user ID and load user from DB
        UUID userId = jwtUtil.getUserIdFromToken(token);
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            filterChain.doFilter(request, response);
            return;
        }

        if (user.getStatus() != User.AccountStatus.ACTIVE) {
            filterChain.doFilter(request, response);
            return;
        }

        // 5. Set authentication in Spring Security context.
        // Staff authorities come from staff_roles, not the users.role enum. They are
        // only loaded for admin-path requests so customer traffic skips the extra query.
        List<SimpleGrantedAuthority> authorities = new ArrayList<>();
        authorities.add(new SimpleGrantedAuthority("ROLE_USER"));
        if (request.getRequestURI().startsWith("/api/v1/admin")) {
            staffRoleService.getEffectiveRoles(user).forEach(role ->
                    authorities.add(new SimpleGrantedAuthority("ROLE_" + role.name())));
        }
        // Agent capability is derived from an ACTIVE Agent record, not stored on the user.
        // Loaded only for agent-path traffic so ordinary requests skip the extra query.
        if (request.getRequestURI().startsWith("/api/v1/agent")) {
            agentRepository.findByUserId(user.getId())
                    .filter(a -> a.getStatus() == Agent.Status.ACTIVE)
                    .ifPresent(a -> authorities.add(new SimpleGrantedAuthority("ROLE_AGENT")));
        }
        UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken(user, null, authorities);

        SecurityContextHolder.getContext().setAuthentication(authentication);

        // 6. Continue the filter chain
        filterChain.doFilter(request, response);
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new AppException("SHA-256 not available", e);
        }
    }
}
