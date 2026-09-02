package com.aza.backend.security.filter;

import com.aza.backend.security.behavior.BehavioralDetectionService;
import com.aza.backend.security.challenge.ChallengeService;
import com.aza.backend.security.fingerprint.RequestFingerprintService;
import com.aza.backend.security.reputation.IpReputationService;
import com.aza.backend.util.RateLimitService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Ghanaian carriers run CGNAT, so one public IP fronts hundreds of unrelated users.
 * Every unauthenticated limit keyed on that IP pools strangers into one bucket. These
 * tests pin the actor key each rule uses, because the failure they guard against is
 * silent: real users get 429s and auto-blocks earned by someone they share a carrier
 * with, and nothing in the logs points at the cause.
 */
class RateLimitFilterActorKeyTest {

    private static final String SHARED_IP = "41.66.10.1";

    private RateLimitFilter filter;
    private RateLimitService rateLimitService;
    private BehavioralDetectionService behavioralDetection;
    private RequestFingerprintService fingerprinter;

    @BeforeEach
    void setUp() {
        rateLimitService = mock(RateLimitService.class);
        behavioralDetection = mock(BehavioralDetectionService.class);
        fingerprinter = mock(RequestFingerprintService.class);
        IpReputationService ipReputation = mock(IpReputationService.class);
        ChallengeService challengeService = mock(ChallengeService.class);

        filter = new RateLimitFilter(rateLimitService, behavioralDetection, ipReputation,
                fingerprinter, challengeService, new ObjectMapper());

        ReflectionTestUtils.setField(filter, "rateLimitEnabled", true);
        ReflectionTestUtils.setField(filter, "ipLimit", 150);
        ReflectionTestUtils.setField(filter, "ipWindowSeconds", 60);
        ReflectionTestUtils.setField(filter, "authIpLimit", 200);
        ReflectionTestUtils.setField(filter, "authIpWindowSeconds", 900);
        ReflectionTestUtils.setField(filter, "authDeviceLimit", 60);
        ReflectionTestUtils.setField(filter, "sharedAuthIpLimit", 2000);
        ReflectionTestUtils.setField(filter, "sharedIpLimit", 1500);
        ReflectionTestUtils.setField(filter, "fingerprintLimit", 300);
        ReflectionTestUtils.setField(filter, "fingerprintWindowSeconds", 60);
        ReflectionTestUtils.setField(filter, "userLimit", 500);
        ReflectionTestUtils.setField(filter, "userWindowSeconds", 60);
        ReflectionTestUtils.setField(filter, "burstThreshold", 40);

        when(fingerprinter.getClientIp(any())).thenReturn(SHARED_IP);
        SecurityContextHolder.clearContext();
    }

    /** Drives one unauthenticated request and returns every rate-limit key it consumed. */
    private List<String> keysUsed(String path, String deviceId, int responseStatus) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", path);
        request.setRequestURI(path);
        if (deviceId != null) {
            request.addHeader("X-Device-ID", deviceId);
            when(fingerprinter.hasStableDeviceId(any())).thenReturn(true);
            when(fingerprinter.getDeviceFingerprint(any())).thenReturn(deviceId);
        } else {
            when(fingerprinter.hasStableDeviceId(any())).thenReturn(false);
            when(fingerprinter.getDeviceFingerprint(any())).thenReturn("derived-shared-hash");
        }

        MockHttpServletResponse response = new MockHttpServletResponse();
        response.setStatus(responseStatus);
        FilterChain chain = mock(FilterChain.class);
        filter.doFilter(request, response, chain);

        ArgumentCaptor<String> keys = ArgumentCaptor.forClass(String.class);
        verify(rateLimitService, atLeastOnce())
                .enforceRateLimit(keys.capture(), anyInt(), any(Duration.class));
        return keys.getAllValues();
    }

    // ==================== AUTH PATHS ====================

    @Test
    void twoDevicesBehindOneCarrierIpDoNotShareTheAuthBudget() throws Exception {
        List<String> deviceA = keysUsed("/api/v1/auth/login", "device-a", 200);
        assertTrue(deviceA.contains("auth_device:device-a"),
                "expected a per-device auth bucket, got " + deviceA);
        assertFalse(deviceA.contains("ip_auth:" + SHARED_IP),
                "the strict per-IP auth bucket must not apply to a device-identified caller");

        reset(rateLimitService);
        List<String> deviceB = keysUsed("/api/v1/auth/login", "device-b", 200);
        assertTrue(deviceB.contains("auth_device:device-b"));
        // The only shared key is the deliberately loose backstop.
        assertEquals(List.of("ip_auth_shared:" + SHARED_IP),
                deviceA.stream().filter(deviceB::contains).toList());
    }

    @Test
    void callerWithNoDeviceIdStillGetsTheStrictPerIpAuthLimit() throws Exception {
        List<String> keys = keysUsed("/api/v1/auth/login", null, 200);
        assertTrue(keys.contains("ip_auth:" + SHARED_IP),
                "credential stuffing from a script is the case the IP limit exists for");
        assertFalse(keys.contains("ip_auth_shared:" + SHARED_IP));
    }

    // ==================== UNAUTHENTICATED NON-AUTH (the check endpoints) ====================

    @Test
    void identifierChecksFromOneDeviceDoNotConsumeTheCarrierIpBudget() throws Exception {
        List<String> keys = keysUsed("/api/v1/users/validate-email", "device-a", 200);
        assertTrue(keys.contains("ip_shared:" + SHARED_IP));
        assertFalse(keys.contains("ip:" + SHARED_IP));
        assertTrue(keys.contains("fp:device-a"), "per-device volume is still bounded");
    }

    // ==================== BEHAVIOURAL SCORING ====================

    @Test
    void failedLoginsAreScoredAgainstTheDeviceNotTheSharedIp() throws Exception {
        when(behavioralDetection.recordFailure(anyString())).thenReturn(11L);

        keysUsed("/api/v1/auth/login", "device-a", 401);

        // Ten mistyped passwords across a carrier is an ordinary afternoon. Scoring them
        // to the IP would auto-block every AZA user on that network.
        verify(behavioralDetection).recordFailure("fp:device-a");
        verify(behavioralDetection).reportSuspiciousEvent("fp:device-a", 20);
        verify(behavioralDetection, never()).recordFailure("ip:" + SHARED_IP);
        verify(behavioralDetection, never()).reportSuspiciousEvent("ip:" + SHARED_IP, 20);
    }

    @Test
    void failedLoginsWithoutADeviceIdAreStillScoredAgainstTheIp() throws Exception {
        when(behavioralDetection.recordFailure(anyString())).thenReturn(11L);

        keysUsed("/api/v1/auth/login", null, 401);

        verify(behavioralDetection).recordFailure("ip:" + SHARED_IP);
        verify(behavioralDetection).reportSuspiciousEvent("ip:" + SHARED_IP, 20);
    }

    @Test
    void burstsAreAttributedToTheDeviceThatMadeThem() throws Exception {
        keysUsed("/api/v1/users/validate-email", "device-a", 200);
        verify(behavioralDetection).trackRequest("fp:device-a");
        verify(behavioralDetection, never()).trackRequest("ip:" + SHARED_IP);
    }

    @Test
    void anAutoBlockOnTheCarrierIpDoesNotBlockDeviceIdentifiedCallers() throws Exception {
        when(behavioralDetection.isBlocked("ip:" + SHARED_IP)).thenReturn(true);

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/users/validate-email");
        request.setRequestURI("/api/v1/users/validate-email");
        request.addHeader("X-Device-ID", "device-a");
        when(fingerprinter.hasStableDeviceId(any())).thenReturn(true);
        when(fingerprinter.getDeviceFingerprint(any())).thenReturn("device-a");

        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);
        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
        assertNotEquals(429, response.getStatus());
    }
}
