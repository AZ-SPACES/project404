package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.agent.AgentApplyRequest;
import com.aza.backend.dto.agent.AgentCashResponse;
import com.aza.backend.dto.agent.AgentMeResponse;
import com.aza.backend.dto.agent.AgentResponse;
import com.aza.backend.dto.agent.CashInRequest;
import com.aza.backend.dto.agent.CashOutRedeemRequest;
import com.aza.backend.entity.User;
import com.aza.backend.entity.Wallet;
import com.aza.backend.repository.AgentRepository;
import com.aza.backend.repository.WalletRepository;
import com.aza.backend.service.AgentCashService;
import com.aza.backend.service.AgentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;

/**
 * Agent-facing surface for the app's Agent mode. Authorisation is by the backing
 * Agent record: {@code /me} reports entitlement (status "NONE" when not an agent)
 * and cash operations enforce ACTIVE status in {@link AgentCashService}.
 */
@RestController
@RequestMapping("/api/v1/agent")
@RequiredArgsConstructor
public class AgentController {

    private final AgentCashService agentCashService;
    private final AgentService agentService;
    private final AgentRepository agentRepository;
    private final WalletRepository walletRepository;

    @PostMapping("/apply")
    public ResponseEntity<ApiResponse<AgentResponse>> apply(
            @Valid @RequestBody AgentApplyRequest request, @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(agentService.apply(user, request)));
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<AgentMeResponse>> me(@AuthenticationPrincipal User user) {
        AgentMeResponse body = agentRepository.findByUserId(user.getId())
                .map(a -> AgentMeResponse.builder()
                        .status(a.getStatus().name())
                        .tier(a.getTier().name())
                        .code(a.getCode())
                        .floatBalance(walletRepository.findByUserIdAndType(user.getId(), Wallet.WalletType.AGENT_FLOAT)
                                .map(Wallet::getBalance).orElse(BigDecimal.ZERO))
                        .commissionAccruedGhs(a.getCommissionAccruedGhs())
                        .floatLimit(a.getFloatLimit())
                        .build())
                .orElseGet(() -> AgentMeResponse.builder().status("NONE").build());
        return ResponseEntity.ok(ApiResponse.success(body));
    }

    @PostMapping("/cash-in")
    @PreAuthorize("hasRole('AGENT')")
    public ResponseEntity<ApiResponse<AgentCashResponse>> cashIn(
            @RequestBody CashInRequest request, @AuthenticationPrincipal User user) {
        AgentCashResponse res = agentCashService.cashIn(
                user, request.getCustomerIdentifier(), request.getAmount(), request.getIdempotencyKey());
        return ResponseEntity.ok(ApiResponse.success(res));
    }

    @PostMapping("/cash-out/redeem")
    @PreAuthorize("hasRole('AGENT')")
    public ResponseEntity<ApiResponse<AgentCashResponse>> cashOut(
            @RequestBody CashOutRedeemRequest request, @AuthenticationPrincipal User user) {
        AgentCashResponse res = agentCashService.cashOut(
                user, request.getCode(), request.getIdempotencyKey());
        return ResponseEntity.ok(ApiResponse.success(res));
    }
}
