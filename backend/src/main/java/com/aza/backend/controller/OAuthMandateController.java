package com.aza.backend.controller;

import io.swagger.v3.oas.annotations.tags.Tag;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.mandate.CreateMandateRequest;
import com.aza.backend.entity.Merchant;
import com.aza.backend.entity.OAuthAccessToken;
import com.aza.backend.entity.PaymentMandate;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.MerchantRepository;
import com.aza.backend.service.OAuthService;
import com.aza.backend.service.PaymentMandateService;
import jakarta.validation.Valid;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Lets a "Sign in with AZA" app request a standing payment mandate on the signed-in user's
 * wallet. Creating one only stages it (PENDING_APPROVAL) — the user still has to approve the
 * specific ceilings on the aza-pay hosted page (this app has no UI of its own on AZA's side),
 * the same way OAuthPaymentController stages a checkout session the user finishes on
 * pay.aza.systems. Mirrors that controller's structure deliberately.
 */
@RestController
@RequestMapping("/oauth/mandates")
@RequiredArgsConstructor
@Tag(name = "OAuth Mandates", description = "Request a standing payment mandate on behalf of a user")
public class OAuthMandateController {

    private final OAuthService oAuthService;
    private final PaymentMandateService mandateService;
    private final MerchantRepository merchantRepository;

    private static final String APPROVAL_BASE = "https://pay.aza.systems/m/";
    private static final String DEEP_LINK_BASE = "aza://mandate/";

    @Data
    public static class CreateOAuthMandateResponse {
        private String mandateId;
        private String approvalUrl;
        private String deepLink;
        private String status;
        private String merchantName;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<CreateOAuthMandateResponse>> create(
            @RequestHeader("Authorization") String authHeader,
            @Valid @RequestBody CreateMandateRequest request) {

        OAuthAccessToken token = resolveToken(authHeader);
        requireScope(token, "direct_debit");

        Merchant merchant = getMerchantForToken(token);
        // The mandate always resolves its own payee from recipientIdentifier — but an OAuth
        // client may only request a mandate paying the merchant it's actually linked to,
        // otherwise any client with the scope could stage a mandate for an unrelated business.
        String handle = request.getRecipientIdentifier().startsWith("@")
                ? request.getRecipientIdentifier().substring(1) : request.getRecipientIdentifier();
        if (!merchant.getBusinessHandle().equalsIgnoreCase(handle)) {
            throw new AppException("MERCHANT_MISMATCH",
                    "This OAuth client can only request mandates for its own linked merchant.", HttpStatus.FORBIDDEN);
        }

        PaymentMandate mandate = mandateService.create(
                token.getUser().getId(), request.getRecipientIdentifier(), request.getPerChargeLimit(),
                request.getPeriodLimit(), request.getPeriodType(), request.getExpiresAt(),
                request.getReference(), PaymentMandate.SourceType.OAUTH, token.getClient().getClientId());

        CreateOAuthMandateResponse response = new CreateOAuthMandateResponse();
        response.setMandateId(mandate.getId().toString());
        response.setApprovalUrl(APPROVAL_BASE + mandate.getId());
        response.setDeepLink(DEEP_LINK_BASE + mandate.getId());
        response.setStatus(mandate.getStatus().name());
        response.setMerchantName(merchant.getBusinessName());

        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    // ── helpers (mirrors OAuthPaymentController) ────────────────────────────

    private OAuthAccessToken resolveToken(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new AppException("UNAUTHORIZED", "Bearer token required.", HttpStatus.UNAUTHORIZED);
        }
        return oAuthService.resolveAccessToken(authHeader.substring(7));
    }

    private void requireScope(OAuthAccessToken token, String scope) {
        if (!token.getScopeList().contains(scope)) {
            throw new AppException("INSUFFICIENT_SCOPE",
                    "Access token does not have the '" + scope + "' scope.", HttpStatus.FORBIDDEN);
        }
    }

    private Merchant getMerchantForToken(OAuthAccessToken token) {
        UUID merchantId = token.getClient().getMerchantId();
        if (merchantId == null) {
            throw new AppException("NO_MERCHANT_LINKED",
                    "This OAuth client is not linked to a merchant account. Link a merchant account in your developer settings.",
                    HttpStatus.BAD_REQUEST);
        }
        return merchantRepository.findById(merchantId)
                .orElseThrow(() -> new AppException("MERCHANT_NOT_FOUND", "Linked merchant not found.", HttpStatus.NOT_FOUND));
    }
}
