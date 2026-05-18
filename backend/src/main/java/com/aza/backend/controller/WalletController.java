package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.service.WalletService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/wallet")
@RequiredArgsConstructor
public class WalletController {

    private final WalletService walletService;

    @GetMapping("/apple/{handle}")
    public ResponseEntity<ApiResponse<Map<String, String>>> getAppleWalletPass(@PathVariable String handle) {
        String url = walletService.getAppleWalletPassUrl(handle);
        return ResponseEntity.ok(ApiResponse.success(Map.of("url", url)));
    }
}
