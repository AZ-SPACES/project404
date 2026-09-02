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
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Controller;

import java.security.Principal;

/**
 * WebRTC signaling over STOMP.
 *
 * <p>The caller is read off the STOMP {@link Principal} rather than with
 * {@code @AuthenticationPrincipal}: that annotation needs the argument resolver
 * from {@code spring-security-messaging}, which is not a dependency of this
 * service, so with it absent every frame on these mappings died before reaching
 * {@link CallService} and the catch blocks hid it — no offer, answer, ICE
 * candidate or hangup was ever relayed. {@code WebSocketAuthInterceptor} puts
 * the full {@link User} on the session principal, so read it from there.
 */
@Controller
@RequiredArgsConstructor
@Slf4j
public class CallWebSocketHandler {

    private final CallService callService;

    @MessageMapping("/call.sdp-offer")
    public void handleSdpOffer(
            @Payload @Valid CallSignalRequest request,
            Principal principal) {
        User user = extractUser(principal);
        if (user == null) {
            log.warn("Dropping call.sdp-offer from an unauthenticated STOMP session");
            return;
        }
        try {
            callService.relaySdpOffer(user, request);
        } catch (Exception e) {
            log.error("SDP offer relay failed for user {}: {}", user.getId(), e.getMessage());
        }
    }

    @MessageMapping("/call.sdp-answer")
    public void handleSdpAnswer(
            @Payload @Valid CallSignalRequest request,
            Principal principal) {
        User user = extractUser(principal);
        if (user == null) {
            log.warn("Dropping call.sdp-answer from an unauthenticated STOMP session");
            return;
        }
        try {
            callService.relaySdpAnswer(user, request);
        } catch (Exception e) {
            log.error("SDP answer relay failed for user {}: {}", user.getId(), e.getMessage());
        }
    }

    @MessageMapping("/call.ice")
    public void handleIceCandidate(
            @Payload @Valid CallSignalRequest request,
            Principal principal) {
        User user = extractUser(principal);
        if (user == null) {
            log.warn("Dropping call.ice from an unauthenticated STOMP session");
            return;
        }
        try {
            callService.relayIceCandidate(user, request);
        } catch (Exception e) {
            log.error("ICE candidate relay failed for user {}: {}", user.getId(), e.getMessage());
        }
    }

    @MessageMapping("/call.end")
    public void handleCallEnd(
            @Payload @Valid CallIdRequest request,
            Principal principal) {
        User user = extractUser(principal);
        if (user == null) {
            log.warn("Dropping call.end from an unauthenticated STOMP session");
            return;
        }
        try {
            callService.endCall(user, request.getCallId());
        } catch (Exception e) {
            log.error("Call end failed for user {}: {}", user.getId(), e.getMessage());
        }
    }

    private User extractUser(Principal principal) {
        if (principal instanceof UsernamePasswordAuthenticationToken auth
                && auth.getPrincipal() instanceof User user) {
            return user;
        }
        return null;
    }
}
