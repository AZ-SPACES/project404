package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.merchant.NotificationPreferenceResponse;
import com.aza.backend.dto.merchant.UpdateNotificationPreferenceRequest;
import com.aza.backend.entity.Merchant;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.MerchantRepository;
import com.aza.backend.service.MerchantNotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/merchant/notification-preferences")
@RequiredArgsConstructor
public class MerchantNotificationController {

    private final MerchantNotificationService merchantNotificationService;
    private final MerchantRepository merchantRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<NotificationPreferenceResponse>> getPreferences(
            @AuthenticationPrincipal User user) {
        UUID merchantId = requireMerchantId(user.getId());
        return ResponseEntity.ok(ApiResponse.success(merchantNotificationService.getPreferences(merchantId)));
    }

    @PutMapping
    public ResponseEntity<ApiResponse<NotificationPreferenceResponse>> updatePreferences(
            @AuthenticationPrincipal User user,
            @RequestBody UpdateNotificationPreferenceRequest request) {
        UUID merchantId = requireMerchantId(user.getId());
        return ResponseEntity.ok(ApiResponse.success(merchantNotificationService.updatePreferences(merchantId, request)));
    }

    private UUID requireMerchantId(UUID userId) {
        Merchant merchant = merchantRepository.findByUserId(userId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "No merchant account found", HttpStatus.NOT_FOUND));
        return merchant.getId();
    }
}
