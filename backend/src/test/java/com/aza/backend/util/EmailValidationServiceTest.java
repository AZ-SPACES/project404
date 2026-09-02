package com.aza.backend.util;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Domain resolution is driven entirely through the Redis cache here so no test
 * touches real DNS.
 */
class EmailValidationServiceTest {

    private EmailValidationService service;
    private Map<String, String> cache;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        cache = new HashMap<>();
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        ValueOperations<String, String> valueOps = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(valueOps);
        when(valueOps.get(anyString())).thenAnswer(inv -> cache.get(inv.getArgument(0, String.class)));
        doAnswer(inv -> {
            cache.put(inv.getArgument(0), inv.getArgument(1));
            return null;
        }).when(valueOps).set(anyString(), anyString(), any(Duration.class));

        service = new EmailValidationService(redis);
        service.loadDisposableDomains();
    }

    private void domainResolves(String domain, boolean resolves) {
        cache.put("email:domain:mx:" + domain, resolves ? "1" : "0");
    }

    // ==================== FORMAT ====================

    @Test
    void rejectsMalformedAddresses() {
        for (String bad : new String[]{null, "", "   ", "kofi", "kofi@", "@gmail.com",
                "kofi@gmail", "kofi gmail.com", "kofi@@gmail.com", "kofi@.com"}) {
            EmailValidationService.Result result = service.validate(bad);
            assertFalse(result.valid(), "expected invalid: " + bad);
            assertEquals(EmailValidationService.Reason.INVALID_FORMAT, result.reason());
        }
    }

    @Test
    void acceptsAddressOnResolvableDomain() {
        domainResolves("gmail.com", true);
        EmailValidationService.Result result = service.validate("Kofi.Mensah@Gmail.com");
        assertTrue(result.valid());
        assertNull(result.reason());
        assertNull(result.suggestion());
    }

    // ==================== BLOCKLIST ====================

    @Test
    void rejectsDisposableDomains() {
        EmailValidationService.Result result = service.validate("someone@mailinator.com");
        assertFalse(result.valid());
        assertEquals(EmailValidationService.Reason.DISPOSABLE_DOMAIN, result.reason());
    }

    @Test
    void disposableCheckIsCaseInsensitiveAndSkipsDns() {
        // No cache entry seeded — a disposable domain must short-circuit before any lookup.
        EmailValidationService.Result result = service.validate("someone@YOPMAIL.com");
        assertEquals(EmailValidationService.Reason.DISPOSABLE_DOMAIN, result.reason());
    }

    // ==================== DOMAIN RESOLUTION ====================

    @Test
    void rejectsDomainThatCannotReceiveMail() {
        domainResolves("nosuchdomain.example", false);
        EmailValidationService.Result result = service.validate("kofi@nosuchdomain.example");
        assertFalse(result.valid());
        assertEquals(EmailValidationService.Reason.UNRESOLVABLE_DOMAIN, result.reason());
    }

    // ==================== TYPO SUGGESTION ====================

    @Test
    void suggestsCorrectionForTransposedProvider() {
        domainResolves("gmial.com", true); // typosquatters really do register these
        EmailValidationService.Result result = service.validate("kofi@gmial.com");
        assertEquals("kofi@gmail.com", result.suggestion());
        assertTrue(result.valid(), "a suggestion is advisory, not a rejection");
    }

    @Test
    void suggestsCorrectionForMistypedTld() {
        domainResolves("gmail.con", false);
        assertEquals("kofi@gmail.com", service.validate("kofi@gmail.con").suggestion());
    }

    @Test
    void suggestsTwoEditCorrectionEvenWhenDomainResolves() {
        // gnail.co is a registered typosquat: it resolves, mail to it goes somewhere, and
        // that is exactly why the user needs the hint.
        domainResolves("gnail.co", true);
        EmailValidationService.Result result = service.validate("kofi@gnail.co");
        assertEquals("kofi@gmail.com", result.suggestion());
        assertTrue(result.valid());
    }

    @Test
    void doesNotSuggestForCorrectOrUnrelatedDomains() {
        domainResolves("gmail.com", true);
        assertNull(service.validate("kofi@gmail.com").suggestion());

        domainResolves("aza.systems", true);
        assertNull(service.validate("kofi@aza.systems").suggestion());

        domainResolves("st.knust.edu.gh", true);
        assertNull(service.validate("kofi@st.knust.edu.gh").suggestion());
    }

    // ==================== DISTANCE ====================

    @Test
    void damerauLevenshteinCountsTranspositionAsOneEdit() {
        assertEquals(1, EmailValidationService.damerauLevenshtein("gmial.com", "gmail.com", 2));
        assertEquals(0, EmailValidationService.damerauLevenshtein("gmail.com", "gmail.com", 2));
        assertEquals(1, EmailValidationService.damerauLevenshtein("gmail.co", "gmail.com", 2));
        assertTrue(EmailValidationService.damerauLevenshtein("aza.systems", "gmail.com", 2) > 2);
    }
}
