package com.aza.backend.security.filter;

import com.aza.backend.entity.Merchant;
import com.aza.backend.entity.MerchantApiKey;
import com.aza.backend.security.fingerprint.RequestFingerprintService;
import com.aza.backend.service.MerchantService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Phase 0 filter behaviour: activation surface, per-resource scope mapping, the
 * payouts-never-implicit rule for secret keys, and the unified ApiResponse error envelope.
 */
class MerchantApiKeyFilterTest {

    private final MerchantService merchantService = mock(MerchantService.class);
    private final RequestFingerprintService fingerprintService = mock(RequestFingerprintService.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    private final MerchantApiKeyFilter filter =
            new MerchantApiKeyFilter(merchantService, fingerprintService, objectMapper);

    private final UUID merchantId = UUID.randomUUID();

    @BeforeEach
    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private Merchant activeMerchant() {
        return Merchant.builder().id(merchantId).userId(UUID.randomUUID())
                .status(Merchant.MerchantStatus.ACTIVE).build();
    }

    private MerchantApiKey key(MerchantApiKey.KeyType type, String scopes) {
        return MerchantApiKey.builder()
                .id(UUID.randomUUID())
                .keyType(type)
                .scopes(scopes)
                .environment(MerchantApiKey.KeyEnvironment.LIVE)
                .build();
    }

    private MockHttpServletResponse run(String method, String path, MerchantApiKey apiKey,
                                        Merchant merchant, MockFilterChain chain) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        request.setRequestURI(path);
        request.addHeader("X-Api-Key", "aza_live_test");
        MockHttpServletResponse response = new MockHttpServletResponse();
        when(fingerprintService.getClientIp(any())).thenReturn("127.0.0.1");
        when(merchantService.validateApiKey(anyString(), anyString(), any())).thenReturn(apiKey);
        when(merchantService.getMerchantForApiKey(apiKey)).thenReturn(merchant);
        filter.doFilter(request, response, chain);
        return response;
    }

    // ── Activation surface ────────────────────────────────────────────────────

    @Test
    void apiKeyManagement_isNeverApiKeyAccessible() {
        // A stolen key must not be able to mint replacement keys.
        assertFalse(MerchantApiKeyFilter.isActivatedPath("/api/v1/merchant/api-keys"));
        assertFalse(MerchantApiKeyFilter.isActivatedPath("/api/v1/merchant/api-keys/logs"));
    }

    @Test
    void documentedSurface_isActivated() {
        for (String p : new String[]{
                "/api/v1/merchant/sessions", "/api/v1/merchant/connect/transfers",
                "/api/v1/merchant/transactions/x", "/api/v1/merchant/webhooks",
                "/api/v1/merchant/payouts", "/api/v1/merchant/auto-payout",
                "/api/v1/merchant/customers", "/api/v1/merchant/disputes",
                "/api/v1/merchant/settlements", "/api/v1/merchant/invoices",
                "/api/v1/merchant/discount-codes"}) {
            assertTrue(MerchantApiKeyFilter.isActivatedPath(p), p);
        }
    }

    @Test
    void unactivatedPath_passesThroughWithoutAuthenticating() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/merchant/api-keys");
        request.setRequestURI("/api/v1/merchant/api-keys");
        request.addHeader("X-Api-Key", "aza_live_test");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertNotNull(chain.getRequest(), "chain should have been invoked");
        assertNull(SecurityContextHolder.getContext().getAuthentication(),
                "no API-key authentication may be established off the activated surface");
    }

    // ── Scope mapping ─────────────────────────────────────────────────────────

    @Test
    void requiredScope_mapsEachResource() {
        assertEquals("sessions:write", MerchantApiKeyFilter.requiredScope("/api/v1/merchant/sessions", true));
        assertEquals("sessions:read", MerchantApiKeyFilter.requiredScope("/api/v1/merchant/sessions/x", false));
        assertEquals("transfers:write", MerchantApiKeyFilter.requiredScope("/api/v1/merchant/connect/transfers", true));
        assertEquals("transactions:read", MerchantApiKeyFilter.requiredScope("/api/v1/merchant/transactions/x", true));
        assertEquals("webhooks:write", MerchantApiKeyFilter.requiredScope("/api/v1/merchant/webhooks", true));
        assertEquals("payouts:write", MerchantApiKeyFilter.requiredScope("/api/v1/merchant/payouts", true));
        assertEquals("payouts:write", MerchantApiKeyFilter.requiredScope("/api/v1/merchant/auto-payout", true));
        assertEquals("payouts:read", MerchantApiKeyFilter.requiredScope("/api/v1/merchant/payouts", false));
        assertEquals("customers:read", MerchantApiKeyFilter.requiredScope("/api/v1/merchant/customers", false));
        assertEquals("disputes:read", MerchantApiKeyFilter.requiredScope("/api/v1/merchant/disputes", false));
        assertEquals("settlements:read", MerchantApiKeyFilter.requiredScope("/api/v1/merchant/settlements", false));
        assertEquals("invoices:write", MerchantApiKeyFilter.requiredScope("/api/v1/merchant/invoices", true));
        assertEquals("discounts:write", MerchantApiKeyFilter.requiredScope("/api/v1/merchant/discount-codes", true));
    }

    // ── Payouts are never implicit ────────────────────────────────────────────

    @Test
    void secretKey_isDeniedPayoutWrites() throws Exception {
        MockFilterChain chain = new MockFilterChain();
        MockHttpServletResponse response = run("POST", "/api/v1/merchant/payouts",
                key(MerchantApiKey.KeyType.SECRET, null), activeMerchant(), chain);

        assertEquals(403, response.getStatus());
        JsonNode body = objectMapper.readTree(response.getContentAsString());
        assertFalse(body.get("success").asBoolean());
        assertEquals("PAYOUTS_REQUIRE_RESTRICTED_KEY", body.get("error").get("code").asText());
        assertNull(chain.getRequest(), "request must not reach the handler");
    }

    @Test
    void restrictedKeyWithPayoutsWrite_isAllowed() throws Exception {
        MockFilterChain chain = new MockFilterChain();
        MockHttpServletResponse response = run("POST", "/api/v1/merchant/payouts",
                key(MerchantApiKey.KeyType.RESTRICTED, "payouts:write"), activeMerchant(), chain);

        assertEquals(200, response.getStatus());
        assertNotNull(chain.getRequest(), "request should reach the handler");
        assertNotNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void secretKey_stillHasImplicitAccessToNonPayoutSurface() throws Exception {
        MockFilterChain chain = new MockFilterChain();
        MockHttpServletResponse response = run("POST", "/api/v1/merchant/invoices",
                key(MerchantApiKey.KeyType.SECRET, null), activeMerchant(), chain);

        assertEquals(200, response.getStatus());
        assertNotNull(chain.getRequest());
    }

    // ── Error envelope ────────────────────────────────────────────────────────

    @Test
    void invalidKey_returnsApiResponseEnvelopeWithCode() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/merchant/sessions");
        request.setRequestURI("/api/v1/merchant/sessions");
        request.addHeader("X-Api-Key", "aza_live_bogus");
        MockHttpServletResponse response = new MockHttpServletResponse();
        when(fingerprintService.getClientIp(any())).thenReturn("127.0.0.1");
        when(merchantService.validateApiKey(anyString(), anyString(), any())).thenReturn(null);

        filter.doFilter(request, response, new MockFilterChain());

        assertEquals(401, response.getStatus());
        JsonNode body = objectMapper.readTree(response.getContentAsString());
        assertFalse(body.get("success").asBoolean());
        assertEquals("INVALID_API_KEY", body.get("error").get("code").asText());
        assertNotNull(body.get("error").get("message"));
    }

    @Test
    void missingScope_returnsMissingScopeCode() throws Exception {
        MockFilterChain chain = new MockFilterChain();
        MockHttpServletResponse response = run("POST", "/api/v1/merchant/webhooks",
                key(MerchantApiKey.KeyType.RESTRICTED, "sessions:write"), activeMerchant(), chain);

        assertEquals(403, response.getStatus());
        JsonNode body = objectMapper.readTree(response.getContentAsString());
        assertEquals("MISSING_SCOPE", body.get("error").get("code").asText());
        assertTrue(body.get("error").get("message").asText().contains("webhooks:write"));
    }

    @Test
    void inactiveMerchant_returnsMerchantNotActive() throws Exception {
        Merchant suspended = Merchant.builder().id(merchantId).userId(UUID.randomUUID())
                .status(Merchant.MerchantStatus.SUSPENDED).build();
        MockHttpServletResponse response = run("GET", "/api/v1/merchant/sessions",
                key(MerchantApiKey.KeyType.SECRET, null), suspended, new MockFilterChain());

        assertEquals(403, response.getStatus());
        JsonNode body = objectMapper.readTree(response.getContentAsString());
        assertEquals("MERCHANT_NOT_ACTIVE", body.get("error").get("code").asText());
    }
}
