package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.security.challenge.ChallengeService;
import com.aza.backend.security.fingerprint.RequestFingerprintService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/security")
@RequiredArgsConstructor
public class ChallengeController {

    private final ChallengeService challengeService;
    private final RequestFingerprintService fingerprinter;

    record VerifyRequest(String challengeToken, String captchaResponse) {}

    /**
     * Verifies a CAPTCHA challenge and returns a bypass token.
     * The client should include the bypass token in X-Bypass-Token on future requests.
     */
    @PostMapping("/verify-challenge")
    public ResponseEntity<ApiResponse<Map<String, String>>> verifyChallenge(
            @RequestBody VerifyRequest body,
            HttpServletRequest request) {

        String ip = fingerprinter.getClientIp(request);
        String bypassToken = challengeService.verifyAndIssueBypass(
                body.challengeToken(), body.captchaResponse(), ip);

        if (bypassToken == null) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("CHALLENGE_FAILED", "CAPTCHA verification failed or challenge expired."));
        }

        return ResponseEntity.ok(ApiResponse.success(Map.of("bypassToken", bypassToken)));
    }
}
