package com.aza.backend.websocket.handler;

import com.aza.backend.dto.call.CallIdRequest;
import com.aza.backend.dto.call.CallSignalRequest;
import com.aza.backend.entity.User;
import com.aza.backend.service.CallService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.stereotype.Controller;


@Controller
@RequiredArgsConstructor
@Slf4j
public class CallWebSocketHandler {

    private final CallService callService;

    @MessageMapping("/call.sdp-offer")
    public void handleSdpOffer(
            @Payload @Valid CallSignalRequest request,
            @AuthenticationPrincipal User user) {
        try {
            callService.relaySdpOffer(user, request);
        } catch (Exception e) {
            log.error("SDP offer relay failed for user {}: {}", user.getId(), e.getMessage());
        }
    }

    @MessageMapping("/call.sdp-answer")
    public void handleSdpAnswer(
            @Payload @Valid CallSignalRequest request,
            @AuthenticationPrincipal User user) {
        try {
            callService.relaySdpAnswer(user, request);
        } catch (Exception e) {
            log.error("SDP answer relay failed for user {}: {}", user.getId(), e.getMessage());
        }
    }

    @MessageMapping("/call.ice")
    public void handleIceCandidate(
            @Payload @Valid CallSignalRequest request,
            @AuthenticationPrincipal User user) {
        try {
            callService.relayIceCandidate(user, request);
        } catch (Exception e) {
            log.error("ICE candidate relay failed for user {}: {}", user.getId(), e.getMessage());
        }
    }

    @MessageMapping("/call.end")
    public void handleCallEnd(
            @Payload @Valid CallIdRequest request,
            @AuthenticationPrincipal User user) {
        try {
            callService.endCall(user, request.getCallId());
        } catch (Exception e) {
            log.error("Call end failed for user {}: {}", user.getId(), e.getMessage());
        }
    }
}
