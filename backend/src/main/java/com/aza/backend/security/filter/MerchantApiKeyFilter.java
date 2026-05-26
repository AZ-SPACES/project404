package com.aza.backend.security.filter;

import com.aza.backend.entity.Merchant;
import com.aza.backend.service.MerchantService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
@RequiredArgsConstructor
public class MerchantApiKeyFilter extends OncePerRequestFilter {

    private static final String API_KEY_HEADER = "X-Api-Key";

    private final MerchantService merchantService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        // Only activate for /api/v1/merchant/sessions (external session creation)
        String path = request.getRequestURI();
        if (!path.startsWith("/api/v1/merchant/sessions")) {
            chain.doFilter(request, response);
            return;
        }

        // Skip if already authenticated (JWT is present)
        if (SecurityContextHolder.getContext().getAuthentication() != null
                && SecurityContextHolder.getContext().getAuthentication().isAuthenticated()) {
            chain.doFilter(request, response);
            return;
        }

        String apiKey = request.getHeader(API_KEY_HEADER);
        if (apiKey == null || apiKey.isBlank()) {
            chain.doFilter(request, response);
            return;
        }

        String keyHash = MerchantService.sha256Hex(apiKey);
        Merchant merchant = merchantService.findMerchantByApiKeyHash(keyHash);

        if (merchant != null && merchant.getStatus() == Merchant.MerchantStatus.ACTIVE) {
            UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                    merchant, null,
                    List.of(new SimpleGrantedAuthority("ROLE_MERCHANT_API"))
            );
            SecurityContextHolder.getContext().setAuthentication(auth);
        }

        chain.doFilter(request, response);
    }
}
