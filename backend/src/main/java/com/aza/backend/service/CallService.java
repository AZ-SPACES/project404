package com.aza.backend.service;

import com.aza.backend.dto.call.*;
import com.aza.backend.dto.websocket.WebSocketEventType;
import com.aza.backend.entity.CallSession;
import com.aza.backend.entity.User;
import com.aza.backend.repository.CallSessionRepository;
import com.aza.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class CallService {

    private final CallSessionRepository callSessionRepository;
    private final UserRepository userRepository;
    private final WebSocketPublisher webSocketPublisher;
    private final NotificationService notificationService;
    private final PresenceService presenceService;

    @Value("${turn.secret:aza-turn-secret-change-in-production}")
    private String turnSecret;

    @Value("${turn.host:turn.azapay.app}")
    private String turnHost;

    @Value("${turn.ttl-seconds:3600}")
    private int turnTtlSeconds;

    private static final int CALL_TIMEOUT_SECONDS = 30;

    // INITIATE CALL

    @Transactional
    public CallResponse initiateCall(User caller, InitiateCallRequest request) {
        if (caller.getId().equals(request.getCalleeId())) {
            throw new RuntimeException("Cannot call yourself");
        }

        User callee = userRepository.findById(request.getCalleeId())
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (callee.getStatus() != User.AccountStatus.ACTIVE) {
            throw new RuntimeException("User is not available");
        }

        CallSession.CallType callType;
        try {
            callType = CallSession.CallType.valueOf(request.getType().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new RuntimeException("Invalid call type. Use VOICE or VIDEO");
        }

        // Create call session record
        CallSession session = CallSession.builder()
                .callerId(caller.getId())
                .calleeId(callee.getId())
                .type(callType)
                .status(CallSession.CallStatus.INITIATING)
                .build();

        session = callSessionRepository.save(session);

        // Build payload to send to callee
        Map<String, Object> payload = buildCallPayload(session, caller, callee);
        payload.put("action", "incoming_call");

        // Notify callee via WebSocket
        webSocketPublisher.publishCallEvent(
                callee.getId(), WebSocketEventType.CALL_INITIATE, payload);

        // If callee is offline, push an incoming-call notification so they see it
        if (!presenceService.isOnline(callee.getId())) {
            notificationService.sendIncomingCallNotification(
                    callee.getId(),
                    caller.getFirstName() + " " + caller.getLastName(),
                    session.getId().toString(),
                    callType == CallSession.CallType.VIDEO);
        }

        log.info("{} call initiated: {} → {}, callId={}",
                callType, caller.getId(), callee.getId(), session.getId());

        return toCallResponse(session, caller, callee);
    }

    // CALL RINGING

    @Transactional
    public void ringCall(User callee, UUID callId) {
        CallSession session = getCallAndVerifyCallee(callId, callee.getId());
        session.setStatus(CallSession.CallStatus.RINGING);
        callSessionRepository.save(session);

        User caller = userRepository.findById(session.getCallerId()).orElseThrow();
        Map<String, Object> payload = buildCallPayload(session, caller, callee);

        webSocketPublisher.publishCallEvent(
                session.getCallerId(), WebSocketEventType.CALL_RINGING, payload);
    }

    // ACCEPT CALL

    @Transactional
    public CallResponse acceptCall(User callee, UUID callId) {
        CallSession session = getCallAndVerifyCallee(callId, callee.getId());

        if (session.getStatus() != CallSession.CallStatus.RINGING &&
                session.getStatus() != CallSession.CallStatus.INITIATING) {
            throw new RuntimeException("Call is no longer available");
        }

        session.setStatus(CallSession.CallStatus.ACTIVE);
        session.setAnsweredAt(LocalDateTime.now());
        callSessionRepository.save(session);

        User caller = userRepository.findById(session.getCallerId()).orElseThrow();
        Map<String, Object> payload = buildCallPayload(session, caller, callee);

        webSocketPublisher.publishCallEvent(
                session.getCallerId(), WebSocketEventType.CALL_ACCEPT, payload);

        log.info("Call {} accepted by {}", callId, callee.getId());
        return toCallResponse(session, caller, callee);
    }

    // DECLINE CALL

    @Transactional
    public void declineCall(User callee, UUID callId) {
        CallSession session = getCallAndVerifyCallee(callId, callee.getId());
        session.setStatus(CallSession.CallStatus.DECLINED);
        session.setEndedAt(LocalDateTime.now());
        callSessionRepository.save(session);

        User caller = userRepository.findById(session.getCallerId()).orElseThrow();
        Map<String, Object> payload = buildCallPayload(session, caller, callee);

        webSocketPublisher.publishCallEvent(
                session.getCallerId(), WebSocketEventType.CALL_DECLINE, payload);

        log.info("Call {} declined by {}", callId, callee.getId());
    }

    // END CALL

    @Transactional
    public void endCall(User user, UUID callId) {
        CallSession session = callSessionRepository.findById(callId)
                .orElseThrow(() -> new RuntimeException("Call not found"));

        // Either participant can end the call
        if (!session.getCallerId().equals(user.getId()) &&
                !session.getCalleeId().equals(user.getId())) {
            throw new RuntimeException("Not authorized to end this call");
        }

        if (session.getStatus() == CallSession.CallStatus.ENDED) {
            return; // Already ended — idempotent
        }

        session.setStatus(CallSession.CallStatus.ENDED);
        session.setEndedAt(LocalDateTime.now());

        if (session.getAnsweredAt() != null) {
            long seconds = java.time.Duration.between(
                    session.getAnsweredAt(), session.getEndedAt()).getSeconds();
            session.setDurationSeconds((int) seconds);
        }

        callSessionRepository.save(session);

        User caller = userRepository.findById(session.getCallerId()).orElseThrow();
        User callee = userRepository.findById(session.getCalleeId()).orElseThrow();

        Map<String, Object> payload = buildCallPayload(session, caller, callee);

        // Notify both participants
        webSocketPublisher.publishCallEvent(
                session.getCallerId(), WebSocketEventType.CALL_END, payload);
        webSocketPublisher.publishCallEvent(
                session.getCalleeId(), WebSocketEventType.CALL_END, payload);

        log.info("Call {} ended, duration: {}s",
                callId, session.getDurationSeconds());
    }

    // RELAY SDP OFFER / ANSWER / ICE CANDIDATE

    public void relaySdpOffer(User sender, CallSignalRequest request) {
        relaySignal(sender, request, WebSocketEventType.SDP_OFFER, "sdp");
    }

    public void relaySdpAnswer(User sender, CallSignalRequest request) {
        relaySignal(sender, request, WebSocketEventType.SDP_ANSWER, "sdp");
    }

    public void relayIceCandidate(User sender, CallSignalRequest request) {
        relaySignal(sender, request, WebSocketEventType.ICE_CANDIDATE, "candidate");
    }

    private void relaySignal(User sender, CallSignalRequest request,
                              WebSocketEventType type, String dataKey) {
        CallSession session = callSessionRepository.findById(request.getCallId())
                .orElseThrow(() -> new RuntimeException("Call not found"));
        if (!session.getCallerId().equals(sender.getId()) &&
                !session.getCalleeId().equals(sender.getId())) {
            throw new RuntimeException("Not a participant of this call");
        }
        UUID targetId = getOtherParticipantId(session, sender.getId());
        webSocketPublisher.publishCallEvent(targetId, type, Map.of(
                "callId", request.getCallId().toString(),
                "from", sender.getId().toString(),
                dataKey, request.getData()
        ));
    }

    //  TURN CREDENTIALS

    /**
     * Generate short-lived TURN credentials using HMAC-SHA1.
     * Compatible with Coturn's REST API authentication.
     * Username format: {@code {expiry}:{userId}}
     * Credential: {@code HMAC-SHA1(turnSecret, username)}
     * See <a href="https://github.com/coturn/coturn/wiki/turnserver">Coturn REST API</a>.
     */
    public TurnCredentials getTurnCredentials(UUID userId) {
        long expiry = (System.currentTimeMillis() / 1000L) + turnTtlSeconds;
        String username = expiry + ":" + userId;

        String credential = generateHmacSha1(turnSecret, username);

        TurnCredentials.IceServer turnServer = TurnCredentials.IceServer.builder()
                .urls(List.of(
                        "turn:" + turnHost + ":3478?transport=udp",
                        "turn:" + turnHost + ":3478?transport=tcp",
                        "turns:" + turnHost + ":5349?transport=tcp"
                ))
                .username(username)
                .credential(credential)
                .build();

        TurnCredentials.IceServer stunServer = TurnCredentials.IceServer.builder()
                .urls(List.of("stun:stun.l.google.com:19302"))
                .build();

        return TurnCredentials.builder()
                .iceServers(List.of(stunServer, turnServer))
                .ttl(turnTtlSeconds)
                .build();
    }

    // MISSED CALLS

    public List<CallResponse> getMissedCalls(UUID userId) {
        return callSessionRepository.findMissedCalls(userId).stream()
                .map(session -> {
                    User caller = userRepository.findById(session.getCallerId()).orElse(null);
                    User callee = userRepository.findById(session.getCalleeId()).orElse(null);
                    return toCallResponse(session, caller, callee);
                })
                .toList();
    }

    // CALL HISTORY

    public Page<CallResponse> getCallHistory(UUID userId, int page, int size) {
        int cappedSize = Math.min(size, 50);
        return callSessionRepository.findAllByUserId(userId, PageRequest.of(page, cappedSize))
                .map(session -> {
                    User caller = userRepository.findById(session.getCallerId()).orElse(null);
                    User callee = userRepository.findById(session.getCalleeId()).orElse(null);
                    return toCallResponse(session, caller, callee);
                });
    }

    //MISSED CALL TIMEOUT (scheduled)

    /**
     * Runs every 10 seconds to mark unanswered calls as MISSED
     * if they've been ringing for more than 30 seconds.
     */
    @Scheduled(fixedDelay = 10000)
    @Transactional
    public void markMissedCalls() {
        LocalDateTime cutoff = LocalDateTime.now().minusSeconds(CALL_TIMEOUT_SECONDS);

        callSessionRepository.findByStatusInAndInitiatedAtBefore(
                List.of(CallSession.CallStatus.INITIATING, CallSession.CallStatus.RINGING),
                cutoff)
                .forEach(session -> {
                    session.setStatus(CallSession.CallStatus.MISSED);
                    session.setEndedAt(LocalDateTime.now());
                    callSessionRepository.save(session);

                    // Notify caller that call was missed
                    Map<String, Object> payload = new HashMap<>();
                    payload.put("callId", session.getId().toString());
                    payload.put("status", "MISSED");

                    webSocketPublisher.publishCallEvent(
                            session.getCallerId(), WebSocketEventType.CALL_MISSED, payload);

                    // Send push notification to callee
                    userRepository.findById(session.getCallerId()).ifPresent(caller ->
                        notificationService.sendMissedCallNotification(
                                session.getCalleeId(),
                                caller.getFirstName() + " " + caller.getLastName(),
                                session.getId().toString(),
                                session.getType() == CallSession.CallType.VIDEO));

                    log.info("Call {} marked as MISSED", session.getId());
                });
    }

    // HELPERS

    private CallSession getCallAndVerifyCallee(UUID callId, UUID calleeId) {
        CallSession session = callSessionRepository.findById(callId)
                .orElseThrow(() -> new RuntimeException("Call not found"));
        if (!session.getCalleeId().equals(calleeId)) {
            throw new RuntimeException("Not authorized for this call");
        }
        return session;
    }

    private UUID getOtherParticipantId(CallSession session, UUID userId) {
        return session.getCallerId().equals(userId)
                ? session.getCalleeId()
                : session.getCallerId();
    }

    private Map<String, Object> buildCallPayload(CallSession session,
                                                   User caller, User callee) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("callId", session.getId().toString());
        payload.put("callerId", session.getCallerId().toString());
        payload.put("callerName", caller.getFirstName() + " " + caller.getLastName());
        payload.put("callerAvatar", caller.getProfileImageUrl());
        payload.put("calleeId", session.getCalleeId().toString());
        payload.put("calleeName", callee.getFirstName() + " " + callee.getLastName());
        payload.put("type", session.getType().name());
        payload.put("status", session.getStatus().name());
        return payload;
    }

    private CallResponse toCallResponse(CallSession session, User caller, User callee) {
        return CallResponse.builder()
                .callId(session.getId().toString())
                .callerId(session.getCallerId().toString())
                .callerName(caller != null
                        ? caller.getFirstName() + " " + caller.getLastName() : "Unknown")
                .callerAvatar(caller != null ? caller.getProfileImageUrl() : null)
                .calleeId(session.getCalleeId().toString())
                .calleeName(callee != null
                        ? callee.getFirstName() + " " + callee.getLastName() : "Unknown")
                .calleeAvatar(callee != null ? callee.getProfileImageUrl() : null)
                .type(session.getType().name())
                .status(session.getStatus().name())
                .initiatedAt(session.getInitiatedAt() != null
                        ? session.getInitiatedAt().toString() : null)
                .answeredAt(session.getAnsweredAt() != null
                        ? session.getAnsweredAt().toString() : null)
                .endedAt(session.getEndedAt() != null
                        ? session.getEndedAt().toString() : null)
                .durationSeconds(session.getDurationSeconds())
                .build();
    }

    private String generateHmacSha1(String secret, String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA1");
            SecretKeySpec keySpec = new SecretKeySpec(
                    secret.getBytes(StandardCharsets.UTF_8), "HmacSHA1");
            mac.init(keySpec);
            byte[] rawHmac = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(rawHmac);
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate HMAC-SHA1 credential", e);
        }
    }
}
