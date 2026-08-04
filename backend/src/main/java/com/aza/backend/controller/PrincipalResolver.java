package com.aza.backend.controller;

import com.aza.backend.entity.Merchant;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import org.springframework.http.HttpStatus;

import java.util.UUID;

/**
 * Resolves the merchant owner's user id from either principal type the merchant API
 * surface accepts: a dashboard JWT authenticates a {@link User}; {@code MerchantApiKeyFilter}
 * authenticates a {@link Merchant}. Handlers on filter-activated paths must use this (or
 * {@code MerchantController.resolveMerchantId}) instead of {@code @AuthenticationPrincipal
 * User}, which injects null for API-key callers and NPEs.
 */
final class PrincipalResolver {

    private PrincipalResolver() {}

    static UUID ownerUserId(Object principal) {
        if (principal instanceof User user) {
            return user.getId();
        }
        if (principal instanceof Merchant merchant) {
            return merchant.getUserId();
        }
        throw new AppException("UNAUTHORIZED", "Not authenticated", HttpStatus.UNAUTHORIZED);
    }
}
