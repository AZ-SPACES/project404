package com.aza.backend.security.filter;

import com.aza.backend.entity.Merchant;
import com.aza.backend.entity.MerchantApiKey;
import com.aza.backend.security.fingerprint.RequestFingerprintService;
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
    /** Request attribute carrying the authenticating key's environment ("LIVE" | "TEST"). */
    public static final String API_KEY_ENVIRONMENT_ATTR = "aza.apiKeyEnvironment";

    private final MerchantService merchantService;
    private final RequestFingerprintService fingerprintService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String path = request.getRequestURI();
        // Activate for the API-key surface: checkout sessions and the Connect (marketplace) API.
        if (!path.startsWith("/api/v1/merchant/sessions")
                && !path.startsWith("/api/v1/merchant/connect")) {
            chain.doFilter(request, response);
            return;
        }

        // Skip if already authenticated (JWT is present)
        if (SecurityContextHolder.getContext().getAuthentication() != null
                && SecurityContextHolder.getContext().getAuthentication().isAuthenticated()) {
            chain.doFilter(request, response);
            return;
        }

        String apiKeyStr = request.getHeader(API_KEY_HEADER);
        if (apiKeyStr == null || apiKeyStr.isBlank()) {
            chain.doFilter(request, response);
            return;
        }

        // Use the centralised fingerprint service which only trusts X-Forwarded-For
        // when the request arrives from a known proxy — prevents IP allowlist bypass.
        String ipAddress = fingerprintService.getClientIp(request);

        String userAgent = request.getHeader("User-Agent");
        String keyHash = MerchantService.sha256Hex(apiKeyStr);

        MerchantApiKey apiKeyEntity = null;
        Merchant merchant = null;
        Integer statusCode = null;
        String errorMessage = null;

        try {
            apiKeyEntity = merchantService.validateApiKey(keyHash, ipAddress, userAgent);
            if (apiKeyEntity != null) {
                merchant = merchantService.getMerchantForApiKey(apiKeyEntity);
            }

            if (apiKeyEntity == null || merchant == null || merchant.getStatus() != Merchant.MerchantStatus.ACTIVE) {
                statusCode = HttpServletResponse.SC_UNAUTHORIZED;
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                response.setContentType("application/json");
                response.getWriter().write("{\"status\":\"error\",\"error\":{\"message\":\"Unauthorized: Invalid API key\"}}");
                return;
            }

            // Verify Restricted scopes
            if (apiKeyEntity.getKeyType() == MerchantApiKey.KeyType.RESTRICTED) {
                // Connect (payout) calls need transfers:* scopes; session calls need sessions:*.
                boolean isConnect = path.startsWith("/api/v1/merchant/connect");
                boolean isWrite = !request.getMethod().equalsIgnoreCase("GET");
                String requiredScope = isConnect
                        ? (isWrite ? "transfers:write" : "transfers:read")
                        : (isWrite ? "sessions:write" : "sessions:read");
                String scopes = apiKeyEntity.getScopes();
                boolean hasScope = false;
                if (scopes != null) {
                    for (String s : scopes.split(",")) {
                        if (s.trim().equalsIgnoreCase(requiredScope)) {
                            hasScope = true;
                            break;
                        }
                    }
                }
                if (!hasScope) {
                    statusCode = HttpServletResponse.SC_FORBIDDEN;
                    response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                    response.setContentType("application/json");
                    response.getWriter().write("{\"status\":\"error\",\"error\":{\"message\":\"Forbidden: API key is missing required scope '" + requiredScope + "'\"}}");
                    return;
                }
            }

            // Authenticate merchant in SecurityContext
            UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                    merchant, null,
                    List.of(new SimpleGrantedAuthority("ROLE_MERCHANT_API"))
            );
            SecurityContextHolder.getContext().setAuthentication(auth);

            // Expose the key's environment so the controller can route to the sandbox.
            // aza_test_ keys → test-mode checkout sessions (no real funds move).
            request.setAttribute(API_KEY_ENVIRONMENT_ATTR, apiKeyEntity.getEnvironment().name());

            chain.doFilter(request, response);
            statusCode = response.getStatus();

        } catch (com.aza.backend.exception.AppException ex) {
            statusCode = ex.getStatus().value();
            errorMessage = ex.getMessage();
            response.setStatus(statusCode);
            response.setContentType("application/json");
            response.getWriter().write("{\"status\":\"error\",\"error\":{\"message\":\"" + errorMessage + "\"}}");
        } catch (Exception ex) {
            statusCode = HttpServletResponse.SC_INTERNAL_SERVER_ERROR;
            errorMessage = ex.getMessage();
            throw ex;
        } finally {
            // Write API request log automatically
            if (apiKeyEntity != null && merchant != null) {
                merchantService.logApiRequest(
                        merchant.getId(),
                        apiKeyEntity.getId(),
                        request.getMethod(),
                        request.getRequestURI(),
                        statusCode != null ? statusCode : response.getStatus(),
                        ipAddress,
                        userAgent,
                        errorMessage
                );
            }
        }
    }
}
