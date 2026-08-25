package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.superagent.DistributeFloatRequest;
import com.aza.backend.dto.superagent.FloatDistributionResponse;
import com.aza.backend.dto.superagent.FloatReconciliationResponse;
import com.aza.backend.dto.superagent.InviteSubAgentRequest;
import com.aza.backend.dto.superagent.SubAgentResponse;
import com.aza.backend.dto.superagent.SuperAgentMeResponse;
import com.aza.backend.dto.superagent.SuperAgentSummaryResponse;
import com.aza.backend.entity.User;
import com.aza.backend.service.SuperAgentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Master-agent portal surface (aza-superagents). ROLE_SUPER_AGENT is derived per-request in
 * {@code JwtAuthenticationFilter} from an ACTIVE agent record of tier SUPER, mirroring how
 * ROLE_AGENT works — it is never stored on the user.
 *
 * <p>{@code /me} is deliberately outside that gate: it reports entitlement (including "NONE"
 * and "NOT_SUPER") so the portal can render a no-access state rather than bounce the user
 * off a 403. Everything that reads or moves float sits behind the role.
 */
@RestController
@RequestMapping("/api/v1/superagent")
@RequiredArgsConstructor
public class SuperAgentController {

    private final SuperAgentService superAgentService;

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<SuperAgentMeResponse>> me(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(superAgentService.me(user)));
    }

    @GetMapping("/summary")
    @PreAuthorize("hasRole('SUPER_AGENT')")
    public ResponseEntity<ApiResponse<SuperAgentSummaryResponse>> summary(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(superAgentService.summary(user)));
    }

    // ── Float movement ──────────────────────────────────────────────────────────

    @PostMapping("/distribute")
    @PreAuthorize("hasRole('SUPER_AGENT')")
    public ResponseEntity<ApiResponse<FloatDistributionResponse>> distribute(
            @Valid @RequestBody DistributeFloatRequest request, @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(superAgentService.distribute(user, request)));
    }

    @PostMapping("/recall")
    @PreAuthorize("hasRole('SUPER_AGENT')")
    public ResponseEntity<ApiResponse<FloatDistributionResponse>> recall(
            @Valid @RequestBody DistributeFloatRequest request, @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(superAgentService.recall(user, request)));
    }

    @GetMapping("/distributions")
    @PreAuthorize("hasRole('SUPER_AGENT')")
    public ResponseEntity<ApiResponse<Page<FloatDistributionResponse>>> distributions(
            @AuthenticationPrincipal User user,
            @RequestParam(required = false) String direction,
            @RequestParam(required = false) UUID subAgentId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                superAgentService.distributions(user, direction, subAgentId, page, size)));
    }

    // ── Downline ────────────────────────────────────────────────────────────────

    @GetMapping("/sub-agents")
    @PreAuthorize("hasRole('SUPER_AGENT')")
    public ResponseEntity<ApiResponse<List<SubAgentResponse>>> subAgents(
            @AuthenticationPrincipal User user,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(ApiResponse.success(superAgentService.subAgents(user, status)));
    }

    @GetMapping("/sub-agents/{subAgentId}")
    @PreAuthorize("hasRole('SUPER_AGENT')")
    public ResponseEntity<ApiResponse<SubAgentResponse>> subAgent(
            @AuthenticationPrincipal User user, @PathVariable UUID subAgentId) {
        return ResponseEntity.ok(ApiResponse.success(superAgentService.subAgent(user, subAgentId)));
    }

    @PostMapping("/sub-agents/invite")
    @PreAuthorize("hasRole('SUPER_AGENT')")
    public ResponseEntity<ApiResponse<SubAgentResponse>> invite(
            @Valid @RequestBody InviteSubAgentRequest request, @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(superAgentService.inviteSubAgent(user, request)));
    }

    // ── Reconciliation ──────────────────────────────────────────────────────────

    @GetMapping("/reconciliation")
    @PreAuthorize("hasRole('SUPER_AGENT')")
    public ResponseEntity<ApiResponse<FloatReconciliationResponse>> reconciliation(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(superAgentService.reconciliation(user)));
    }
}
