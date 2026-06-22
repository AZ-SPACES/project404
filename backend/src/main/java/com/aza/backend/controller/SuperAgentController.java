package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.agent.DistributeFloatRequest;
import com.aza.backend.dto.agent.FloatDistributionResponse;
import com.aza.backend.entity.User;
import com.aza.backend.service.SuperAgentService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * Superagent-facing surface for tiered float distribution. A SUPER-tier agent moves
 * e-float down to ordinary agents against the physical cash they collect. The AGENT
 * role gates the endpoint; {@link SuperAgentService} enforces the SUPER tier.
 */
@RestController
@RequestMapping("/api/v1/superagent")
@RequiredArgsConstructor
public class SuperAgentController {

    private final SuperAgentService superAgentService;

    @PostMapping("/distribute")
    @PreAuthorize("hasRole('AGENT')")
    public ResponseEntity<ApiResponse<FloatDistributionResponse>> distribute(
            @RequestBody DistributeFloatRequest request, @AuthenticationPrincipal User user) {
        FloatDistributionResponse res = superAgentService.distribute(
                user, request.getTargetAgentCode(), request.getAmount(), request.getIdempotencyKey());
        return ResponseEntity.ok(ApiResponse.success(res));
    }

    @GetMapping("/distributions")
    @PreAuthorize("hasRole('AGENT')")
    public ResponseEntity<ApiResponse<Page<FloatDistributionResponse>>> distributions(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(superAgentService.distributions(user, page, size)));
    }
}
