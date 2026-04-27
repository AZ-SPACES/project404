package com.aza.backend.security;

import com.aza.backend.entity.User;
import com.aza.backend.repository.UserRepository;
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
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;
    private final StringRedisTemplate redisTemplate;

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

        // 5. Set authentication in Spring Security context
        UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken(
                        user,                                           // principal (the User object)
                        null,                                           // credentials (not needed)
                        List.of(new SimpleGrantedAuthority("ROLE_USER")) // authorities
                );

        SecurityContextHolder.getContext().setAuthentication(authentication);

        // 6. Continue the filter chain
        filterChain.doFilter(request, response);
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }
}
