package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.call.*;
import com.aza.backend.entity.User;
import com.aza.backend.service.CallService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/calls")
@RequiredArgsConstructor
public class CallController {

    private final CallService callService;

    /**
     * POST /api/v1/calls
     * Initiate a voice or video call.
     */
    @PostMapping
    public ResponseEntity<ApiResponse<CallResponse>> initiateCall(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody InitiateCallRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(callService.initiateCall(user, request)));
    }

    /**
     * POST /api/v1/calls/{callId}/ring
     * Callee confirms they received the incoming call notification.
     */
    @PostMapping("/{callId}/ring")
    public ResponseEntity<ApiResponse<String>> ringCall(
            @AuthenticationPrincipal User user,
            @PathVariable UUID callId) {
        callService.ringCall(user, callId);
        return ResponseEntity.ok(ApiResponse.success("Ringing"));
    }

    /**
     * POST /api/v1/calls/{callId}/accept
     * Callee accepts the call — triggers SDP exchange.
     */
    @PostMapping("/{callId}/accept")
    public ResponseEntity<ApiResponse<CallResponse>> acceptCall(
            @AuthenticationPrincipal User user,
            @PathVariable UUID callId) {
        return ResponseEntity.ok(ApiResponse.success(callService.acceptCall(user, callId)));
    }

    /**
     * POST /api/v1/calls/{callId}/decline
     * Callee declines the incoming call.
     */
    @PostMapping("/{callId}/decline")
    public ResponseEntity<ApiResponse<String>> declineCall(
            @AuthenticationPrincipal User user,
            @PathVariable UUID callId) {
        callService.declineCall(user, callId);
        return ResponseEntity.ok(ApiResponse.success("Call declined"));
    }

    /**
     * POST /api/v1/calls/{callId}/end
     * Either participant ends the call.
     */
    @PostMapping("/{callId}/end")
    public ResponseEntity<ApiResponse<String>> endCall(
            @AuthenticationPrincipal User user,
            @PathVariable UUID callId) {
        callService.endCall(user, callId);
        return ResponseEntity.ok(ApiResponse.success("Call ended"));
    }

    /**
     * POST /api/v1/calls/sdp-offer
     * Relay WebRTC SDP offer to the other participant.
     */
    @PostMapping("/sdp-offer")
    public ResponseEntity<ApiResponse<String>> relaySdpOffer(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody CallSignalRequest request) {
        callService.relaySdpOffer(user, request);
        return ResponseEntity.ok(ApiResponse.success("SDP offer relayed"));
    }

    /**
     * POST /api/v1/calls/sdp-answer
     * Relay WebRTC SDP answer to the caller.
     */
    @PostMapping("/sdp-answer")
    public ResponseEntity<ApiResponse<String>> relaySdpAnswer(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody CallSignalRequest request) {
        callService.relaySdpAnswer(user, request);
        return ResponseEntity.ok(ApiResponse.success("SDP answer relayed"));
    }

    /**
     * POST /api/v1/calls/ice-candidate
     * Relay ICE candidate for NAT traversal.
     */
    @PostMapping("/ice-candidate")
    public ResponseEntity<ApiResponse<String>> relayIceCandidate(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody CallSignalRequest request) {
        callService.relayIceCandidate(user, request);
        return ResponseEntity.ok(ApiResponse.success("ICE candidate relayed"));
    }

    /**
     * GET /api/v1/calls/turn-credentials
     * Get short-lived TURN server credentials for WebRTC NAT traversal.
     * Call this before initiating or accepting a call.
     */
    @GetMapping("/turn-credentials")
    public ResponseEntity<ApiResponse<TurnCredentials>> getTurnCredentials(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(
                callService.getTurnCredentials(user.getId())));
    }

    /**
     * GET /api/v1/calls/missed
     * Get all missed calls for the current user.
     */
    @GetMapping("/missed")
    public ResponseEntity<ApiResponse<List<CallResponse>>> getMissedCalls(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(
                callService.getMissedCalls(user.getId())));
    }

    /**
     * GET /api/v1/calls/history
     * Get paginated call history.
     */
    @GetMapping("/history")
    public ResponseEntity<ApiResponse<Page<CallResponse>>> getCallHistory(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                callService.getCallHistory(user.getId(), page, size)));
    }

    // ── Video upgrade ──────────────────────────────────────────────────────────

    /**
     * POST /api/v1/calls/{callId}/upgrade
     * Request to upgrade an active VOICE call to VIDEO.
     * Sends CALL_UPGRADE_REQUEST to the other participant.
     */
    @PostMapping("/{callId}/upgrade")
    public ResponseEntity<ApiResponse<CallResponse>> requestUpgrade(
            @AuthenticationPrincipal User user,
            @PathVariable UUID callId) {
        return ResponseEntity.ok(ApiResponse.success(callService.requestUpgrade(user, callId)));
    }

    /**
     * POST /api/v1/calls/{callId}/upgrade/accept
     * Accept a pending video upgrade request.
     * Both sides receive CALL_UPGRADE_ACCEPTED and must renegotiate WebRTC.
     */
    @PostMapping("/{callId}/upgrade/accept")
    public ResponseEntity<ApiResponse<CallResponse>> acceptUpgrade(
            @AuthenticationPrincipal User user,
            @PathVariable UUID callId) {
        return ResponseEntity.ok(ApiResponse.success(callService.acceptUpgrade(user, callId)));
    }

    /**
     * POST /api/v1/calls/{callId}/upgrade/decline
     * Decline a pending video upgrade request.
     * Sends CALL_UPGRADE_DECLINED to the requester only.
     */
    @PostMapping("/{callId}/upgrade/decline")
    public ResponseEntity<ApiResponse<String>> declineUpgrade(
            @AuthenticationPrincipal User user,
            @PathVariable UUID callId) {
        callService.declineUpgrade(user, callId);
        return ResponseEntity.ok(ApiResponse.success("Upgrade request declined"));
    }

    // ── Reconnection ───────────────────────────────────────────────────────────

    /**
     * POST /api/v1/calls/{callId}/reconnect
     * Signal an ICE failure — transitions call to RECONNECTING.
     * Both participants receive CALL_RECONNECTING and must perform an ICE restart
     * by exchanging a fresh SDP offer/answer via the existing /sdp-offer and /sdp-answer endpoints.
     */
    @PostMapping("/{callId}/reconnect")
    public ResponseEntity<ApiResponse<String>> reconnectCall(
            @AuthenticationPrincipal User user,
            @PathVariable UUID callId) {
        callService.reconnectCall(user, callId);
        return ResponseEntity.ok(ApiResponse.success("Reconnecting"));
    }

    /**
     * POST /api/v1/calls/{callId}/reconnected
     * Confirm that ICE restart succeeded — transitions call back to ACTIVE.
     * Both participants receive CALL_RECONNECTED.
     */
    @PostMapping("/{callId}/reconnected")
    public ResponseEntity<ApiResponse<String>> confirmReconnected(
            @AuthenticationPrincipal User user,
            @PathVariable UUID callId) {
        callService.confirmReconnected(user, callId);
        return ResponseEntity.ok(ApiResponse.success("Call reconnected"));
    }
}
