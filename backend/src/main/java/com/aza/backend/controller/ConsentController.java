package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.entity.User;
import com.aza.backend.entity.UserConsent;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.UserConsentRepository;
import com.aza.backend.security.fingerprint.RequestFingerprintService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Mobile/web record which T&C / privacy-policy version the user accepted; append-only DPA evidence. */
@RestController
@RequestMapping("/api/v1/consents")
@RequiredArgsConstructor
public class ConsentController {

    private final UserConsentRepository consentRepository;
    private final RequestFingerprintService fingerprintService;

    @PostMapping
    public ResponseEntity<ApiResponse<UserConsent>> record(
            @RequestBody ConsentRequest request,
            @AuthenticationPrincipal User user,
            HttpServletRequest httpRequest) {
        if (request.getVersion() == null || request.getVersion().isBlank()) {
            throw new AppException("INVALID_CONSENT", "A document version is required", HttpStatus.BAD_REQUEST);
        }
        UserConsent.DocType docType;
        try {
            docType = UserConsent.DocType.valueOf(request.getDocType().toUpperCase());
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new AppException("INVALID_CONSENT", "docType must be TERMS or PRIVACY", HttpStatus.BAD_REQUEST);
        }
        return ResponseEntity.ok(ApiResponse.success(consentRepository.save(UserConsent.builder()
                .userId(user.getId())
                .docType(docType)
                .version(request.getVersion().trim())
                .ipAddress(fingerprintService.getClientIp(httpRequest))
                .build())));
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<List<UserConsent>>> myConsents(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(
                consentRepository.findByUserIdOrderByAcceptedAtDesc(user.getId())));
    }

    @Data
    static class ConsentRequest {
        private String docType;
        private String version;
    }
}
