package com.aza.backend.service;

import com.aza.backend.dto.e2ee.KeyBundleResponse;
import com.aza.backend.dto.e2ee.KeyBundleUploadRequest;
import com.aza.backend.dto.e2ee.OtpkReplenishRequest;
import com.aza.backend.dto.websocket.WebSocketEventType;
import com.aza.backend.entity.User;
import com.aza.backend.entity.UserKeyBundle;
import com.aza.backend.repository.ChatRepository;
import com.aza.backend.repository.UserKeyBundleRepository;
import com.aza.backend.repository.UserRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import com.aza.backend.exception.AppException;

@Service
@RequiredArgsConstructor
@Slf4j
public class KeyBundleService {

    private final UserRepository userRepository;
    private final UserKeyBundleRepository userKeyBundleRepository;
    private final ChatRepository chatRepository;
    private final ObjectMapper objectMapper;
    private final WebSocketPublisher webSocketPublisher;

    private static final int LOW_OPK_THRESHOLD = 10;

    // ── Upload / rotate ───────────────────────────────────────────────────────

    @Transactional
    public void uploadKeyBundle(User user, KeyBundleUploadRequest request) {
        Optional<UserKeyBundle> existing =
                userKeyBundleRepository.findByUserIdAndDeviceId(user.getId(), request.getDeviceId());

        UserKeyBundle bundle;
        if (existing.isPresent()) {
            bundle = existing.get();
        } else {
            bundle = UserKeyBundle.builder()
                    .userId(user.getId())
                    .deviceId(request.getDeviceId())
                    .build();
        }

        bundle.setIdentityPublicKey(request.getIdentityPublicKey());
        bundle.setSignedPreKeyPublic(request.getSignedPreKeyPublic());
        bundle.setSignedPreKeySignature(request.getSignedPreKeySignature());

        try {
            bundle.setOneTimePreKeysJson(
                    objectMapper.writeValueAsString(request.getOneTimePreKeys()));
        } catch (JsonProcessingException e) {
            throw new AppException("Failed to serialize one-time pre-keys");
        }

        userKeyBundleRepository.save(bundle);
        log.info("Key bundle uploaded for user {} device {}, OPK count: {}",
                user.getId(), request.getDeviceId(), request.getOneTimePreKeys().size());
    }

    // ── Fetch (single device — pops one OPK) ─────────────────────────────────

    @Transactional
    public KeyBundleResponse fetchKeyBundle(UUID requesterId, UUID recipientId) {
        chatRepository.findByParticipants(requesterId, recipientId)
                .orElseThrow(() -> new AppException("Key bundle not available"));

        List<UserKeyBundle> bundles = userKeyBundleRepository.findByUserId(recipientId);
        if (bundles.isEmpty()) {
            throw new AppException("Recipient has not set up E2EE keys yet");
        }

        // Return the most recently updated bundle; pop one OPK from it.
        UserKeyBundle bundle = bundles.stream()
                .max(Comparator.comparing(b -> b.getUpdatedAt() != null ? b.getUpdatedAt() : b.getCreatedAt()))
                .orElse(bundles.get(0));

        return buildResponseWithOpk(bundle, recipientId);
    }

    // ── Fetch all devices for a recipient ─────────────────────────────────────

    @Transactional
    public List<KeyBundleResponse> fetchAllKeyBundles(UUID requesterId, UUID recipientId) {
        chatRepository.findByParticipants(requesterId, recipientId)
                .orElseThrow(() -> new AppException("Key bundles not available"));

        List<UserKeyBundle> bundles = userKeyBundleRepository.findByUserId(recipientId);
        if (bundles.isEmpty()) {
            throw new AppException("Recipient has not set up E2EE keys yet");
        }

        List<KeyBundleResponse> responses = new ArrayList<>();
        for (UserKeyBundle bundle : bundles) {
            responses.add(buildResponseWithOpk(bundle, recipientId));
        }
        return responses;
    }

    // ── Fetch own device bundles (for encrypting to sender's other devices) ───

    public List<KeyBundleResponse> fetchOwnBundles(UUID userId) {
        return userKeyBundleRepository.findByUserId(userId).stream()
                .map(b -> toResponse(b, null, null))
                .toList();
    }

    // ── OPK replenishment ─────────────────────────────────────────────────────

    @Transactional
    public int replenishOtpks(User user, OtpkReplenishRequest request) {
        UserKeyBundle bundle = userKeyBundleRepository
                .findByUserIdAndDeviceId(user.getId(), request.getDeviceId())
                .orElseThrow(() -> new AppException("Key bundle not found for device: " + request.getDeviceId()));

        List<Map<String, Object>> existing = new ArrayList<>();
        if (bundle.getOneTimePreKeysJson() != null) {
            try {
                existing = objectMapper.readValue(
                        bundle.getOneTimePreKeysJson(), new TypeReference<>() {});
            } catch (JsonProcessingException e) {
                log.warn("Failed to parse existing OPKs for device {}, starting fresh", request.getDeviceId());
            }
        }

        for (KeyBundleUploadRequest.OneTimePreKey opk : request.getOneTimePreKeys()) {
            Map<String, Object> opkMap = new HashMap<>();
            opkMap.put("keyId", opk.getKeyId());
            opkMap.put("publicKey", opk.getPublicKey());
            existing.add(opkMap);
        }

        try {
            bundle.setOneTimePreKeysJson(objectMapper.writeValueAsString(existing));
            userKeyBundleRepository.save(bundle);
        } catch (JsonProcessingException e) {
            throw new AppException("Failed to serialize OPKs");
        }

        log.info("OPKs replenished for user {} device {}, total: {}",
                user.getId(), request.getDeviceId(), existing.size());
        return existing.size();
    }

    // ── OPK count (any device for this user) ──────────────────────────────────

    public int getOpkCount(UUID userId) {
        return userKeyBundleRepository.findByUserId(userId).stream()
                .mapToInt(this::opkCount)
                .sum();
    }

    public boolean hasKeyBundle(UUID userId) {
        return !userKeyBundleRepository.findByUserId(userId).isEmpty();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private KeyBundleResponse buildResponseWithOpk(UserKeyBundle bundle, UUID recipientId) {
        Integer opkId = null;
        String opkPublic = null;

        if (bundle.getOneTimePreKeysJson() != null) {
            try {
                List<Map<String, Object>> opks = objectMapper.readValue(
                        bundle.getOneTimePreKeysJson(), new TypeReference<>() {});
                if (!opks.isEmpty()) {
                    Map<String, Object> opk = opks.removeFirst();
                    opkId = (Integer) opk.get("keyId");
                    opkPublic = (String) opk.get("publicKey");

                    bundle.setOneTimePreKeysJson(objectMapper.writeValueAsString(opks));
                    userKeyBundleRepository.save(bundle);

                    log.info("OPK consumed for recipient {} device {}, remaining: {}",
                            recipientId, bundle.getDeviceId(), opks.size());

                    if (opks.size() < LOW_OPK_THRESHOLD) {
                        notifyLowOpks(recipientId, bundle.getDeviceId(), opks.size());
                    }
                }
            } catch (JsonProcessingException e) {
                log.error("Failed to parse OPKs for user {} device {}: {}",
                        recipientId, bundle.getDeviceId(), e.getMessage());
            }
        }

        return toResponse(bundle, opkId != null ? String.valueOf(opkId) : null, opkPublic);
    }

    private KeyBundleResponse toResponse(UserKeyBundle bundle, String opkId, String opkPublic) {
        return KeyBundleResponse.builder()
                .recipientId(bundle.getUserId().toString())
                .deviceId(bundle.getDeviceId())
                .identityPublicKey(bundle.getIdentityPublicKey())
                .signedPreKeyPublic(bundle.getSignedPreKeyPublic())
                .signedPreKyPublic(bundle.getSignedPreKeyPublic()) // legacy typo field
                .signedPreKeySignature(bundle.getSignedPreKeySignature())
                .oneTimePreKeyId(opkId)
                .oneTimePreKeyPublic(opkPublic)
                .build();
    }

    private int opkCount(UserKeyBundle bundle) {
        if (bundle.getOneTimePreKeysJson() == null) return 0;
        try {
            return ((List<?>) objectMapper.readValue(bundle.getOneTimePreKeysJson(), List.class)).size();
        } catch (JsonProcessingException e) {
            return 0;
        }
    }

    private void notifyLowOpks(UUID recipientId, String deviceId, int remaining) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("message", "One-time pre-keys running low");
            payload.put("deviceId", deviceId);
            payload.put("remaining", remaining);
            payload.put("threshold", LOW_OPK_THRESHOLD);
            webSocketPublisher.publishNotification(
                    recipientId, WebSocketEventType.NOTIFICATION_NEW, payload);
        } catch (Exception e) {
            log.error("Failed to notify user {} of low OPKs: {}", recipientId, e.getMessage());
        }
    }
}
