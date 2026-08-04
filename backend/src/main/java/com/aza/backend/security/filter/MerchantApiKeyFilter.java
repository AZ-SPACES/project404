package com.aza.backend.security.filter;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.entity.Merchant;
import com.aza.backend.entity.MerchantApiKey;
import com.aza.backend.security.fingerprint.RequestFingerprintService;
import com.aza.backend.service.MerchantService;
import com.fasterxml.jackson.databind.ObjectMapper;
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
    /**
     * Request attribute carrying the authenticating key's environment ("LIVE" |
     * "TEST").
     */
    public static final String API_KEY_ENVIRONMENT_ATTR = "aza.apiKeyEnvironment";
    /**
     * Request attribute carrying the authenticating key's id, so money-moving
     * handlers can
     * record which key authorized the action ("which of your keys released this" is
     * a
     * question integrators ask, and hold_events answers it).
     */
    public static final String API_KEY_ID_ATTR = "aza.apiKeyId";

    /**
     * Path prefixes where API-key authentication is accepted — the documented
     * integrator
     * surface. Handlers on every listed prefix accept both principal types (see
     * {@code resolveMerchantId}/{@code PrincipalResolver}); add a prefix ONLY after
     * converting its handlers, or API-key calls will reach
     * {@code @AuthenticationPrincipal
     * User} handlers as null and 500.
     *
     * {@code /merchant/api-keys} is deliberately absent: managing keys with a key
     * would
     * let a stolen key mint its own replacements. Key management stays
     * dashboard-only.
     */
    private static final String[] ACTIVATED_PREFIXES = {
            "/api/v1/merchant/sessions",
            "/api/v1/merchant/connect",
            "/api/v1/merchant/transactions",
            "/api/v1/merchant/webhooks",
            "/api/v1/merchant/payouts",
            "/api/v1/merchant/auto-payout",
            "/api/v1/merchant/customers",
            "/api/v1/merchant/disputes",
            "/api/v1/merchant/settlements",
            "/api/v1/merchant/invoices",
            "/api/v1/merchant/discount-codes",
            "/api/v1/merchant/mandates",
            "/api/v1/merchant/me",
    };

    private final MerchantService merchantService;
    private final RequestFingerprintService fingerprintService;
    private final ObjectMapper objectMapper;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain chain) throws ServletException, IOException {
        String path = request.getRequestURI();
        if (!isActivatedPath(path)) {
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

            if (apiKeyEntity == null || merchant == null) {
                statusCode = HttpServletResponse.SC_UNAUTHORIZED;
                writeError(response, statusCode, "INVALID_API_KEY", "Invalid API key");
                return;
            }
            if (merchant.getStatus() != Merchant.MerchantStatus.ACTIVE) {
                statusCode = HttpServletResponse.SC_FORBIDDEN;
                writeError(response, statusCode, "MERCHANT_NOT_ACTIVE",
                        "Merchant account is not active");
                return;
            }

            boolean isWrite = !request.getMethod().equalsIgnoreCase("GET");

            // Payout writes and mandate charges both move money out without any further
            // confirmation from the payer, so neither is ever implicit: a secret key cannot
            // do either, and a restricted key must explicitly carry the write scope.
            // Charging
            // a mandate is the direct-debit equivalent of a payout — the payer already
            // authorized it once at mandate approval, so the API key is the only gate left.
            // Everything else follows the usual rule — secret keys have full access,
            // restricted keys are scope-gated.
            boolean isPayoutWrite = isWrite
                    && (path.startsWith("/api/v1/merchant/payouts")
                            || path.startsWith("/api/v1/merchant/auto-payout"));
            if (isPayoutWrite && apiKeyEntity.getKeyType() == MerchantApiKey.KeyType.SECRET) {
                statusCode = HttpServletResponse.SC_FORBIDDEN;
                writeError(response, statusCode, "PAYOUTS_REQUIRE_RESTRICTED_KEY",
                        "Payout operations require a restricted API key with the payouts:write scope");
                return;
            }
            boolean isMandateCharge = isWrite && path.matches("^/api/v1/merchant/mandates/[^/]+/charge$");
            if (isMandateCharge && apiKeyEntity.getKeyType() == MerchantApiKey.KeyType.SECRET) {
                statusCode = HttpServletResponse.SC_FORBIDDEN;
                writeError(response, statusCode, "MANDATES_REQUIRE_RESTRICTED_KEY",
                        "Charging a mandate requires a restricted API key with the mandates:write scope");
                return;
            }

            if (apiKeyEntity.getKeyType() == MerchantApiKey.KeyType.RESTRICTED) {
                String requiredScope = requiredScope(path, isWrite);
                if (!hasScope(apiKeyEntity.getScopes(), requiredScope)) {
                    statusCode = HttpServletResponse.SC_FORBIDDEN;
                    writeError(response, statusCode, "MISSING_SCOPE",
                            "API key is missing required scope '" + requiredScope + "'");
                    return;
                }
            }

            // Authenticate merchant in SecurityContext
            UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                    merchant, null,
                    List.of(new SimpleGrantedAuthority("ROLE_MERCHANT_API")));
            SecurityContextHolder.getContext().setAuthentication(auth);

            // Expose the key's environment so the controller can route to the sandbox.
            // aza_test_ keys → test-mode checkout sessions (no real funds move).
            request.setAttribute(API_KEY_ENVIRONMENT_ATTR, apiKeyEntity.getEnvironment().name());
            request.setAttribute(API_KEY_ID_ATTR, apiKeyEntity.getId());

            chain.doFilter(request, response);
            statusCode = response.getStatus();

        } catch (com.aza.backend.exception.AppException ex) {
            statusCode = ex.getStatus().value();
            errorMessage = ex.getMessage();
            writeError(response, statusCode, ex.getCode(), errorMessage);
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
                        errorMessage);
            }
        }
    }

    static boolean isActivatedPath(String path) {
        for (String prefix : ACTIVATED_PREFIXES) {
            if (path.startsWith(prefix))
                return true;
        }
        return false;
    }

    /**
     * Scope a RESTRICTED key must carry for {@code path}. Package-private for
     * tests.
     */
    static String requiredScope(String path, boolean isWrite) {
        if (path.startsWith("/api/v1/merchant/connect"))
            return isWrite ? "transfers:write" : "transfers:read";
        if (path.startsWith("/api/v1/merchant/transactions"))
            return "transactions:read";
        if (path.startsWith("/api/v1/merchant/webhooks"))
            return isWrite ? "webhooks:write" : "webhooks:read";
        if (path.startsWith("/api/v1/merchant/payouts")
                || path.startsWith("/api/v1/merchant/auto-payout"))
            return isWrite ? "payouts:write" : "payouts:read";
        if (path.startsWith("/api/v1/merchant/customers"))
            return "customers:read";
        if (path.startsWith("/api/v1/merchant/disputes"))
            return isWrite ? "disputes:write" : "disputes:read";
        if (path.startsWith("/api/v1/merchant/settlements"))
            return "settlements:read";
        if (path.startsWith("/api/v1/merchant/invoices"))
            return isWrite ? "invoices:write" : "invoices:read";
        if (path.startsWith("/api/v1/merchant/discount-codes"))
            return isWrite ? "discounts:write" : "discounts:read";
        if (path.startsWith("/api/v1/merchant/me"))
            return isWrite ? "profile:write" : "profile:read";
        // Checkout sessions and everything nested under them (refund, expire,
        // simulate).
        return isWrite ? "sessions:write" : "sessions:read";
    }

    private static boolean hasScope(String scopes, String requiredScope) {
        if (scopes == null)
            return false;
        for (String s : scopes.split(",")) {
            if (s.trim().equalsIgnoreCase(requiredScope))
                return true;
        }
        return false;
    }

    /**
     * Error bodies use the same {@link ApiResponse} envelope as every controller,
     * so an
     * integrator's response parser sees one shape everywhere. (Previously the
     * filter
     * hand-built a {@code {"status":"error"}} JSON string — a different envelope,
     * and an
     * injection hazard since exception messages were concatenated unescaped.)
     */
    private void writeError(HttpServletResponse response, int status, String code, String message)
            throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.getWriter().write(objectMapper.writeValueAsString(ApiResponse.error(code, message)));
    }
}
