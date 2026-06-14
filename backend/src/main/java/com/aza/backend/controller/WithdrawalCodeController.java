package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.agent.GenerateWithdrawalCodeRequest;
import com.aza.backend.dto.agent.WithdrawalCodeResponse;
import com.aza.backend.entity.User;
import com.aza.backend.service.WithdrawalCodeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Customer-facing: generate a one-time code an agent redeems to release cash. */
@RestController
@RequestMapping("/api/v1/withdrawal-codes")
@RequiredArgsConstructor
public class WithdrawalCodeController {

    private final WithdrawalCodeService withdrawalCodeService;

    @PostMapping
    public ResponseEntity<ApiResponse<WithdrawalCodeResponse>> generate(
            @RequestBody GenerateWithdrawalCodeRequest request, @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(
                withdrawalCodeService.generate(user, request.getAmount())));
    }
}
