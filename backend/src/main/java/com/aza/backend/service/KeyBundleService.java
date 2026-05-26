package com.aza.backend.service;

import com.aza.backend.dto.e2ee.KeyBundleResponse;
import com.aza.backend.dto.e2ee.KeyBundleUploadRequest;
import com.aza.backend.dto.e2ee.OtpkReplenishRequest;
import com.aza.backend.dto.websocket.WebSocketEventType;
import com.aza.backend.entity.User;
import com.aza.backend.repository.ChatRepository;
import com.aza.backend.repository.UserRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class KeyBundleService {
    private final UserRepository userRepository;
    private final ChatRepository chatRepository;
    private final ObjectMapper objectMapper;
    private final WebSocketPublisher webSocketPublisher;
    
    private static final int LOW_OPK_THRESHOLD = 10;
    
    @Transactional
    public void uploadKeyBundle(User user, KeyBundleUploadRequest request) {
        user.setIdentityPublicKey(request.getIdentityPublicKey());
        user.setSignedPreKeyPublic(request.getSignedPreKeyPublic());
        user.setSignedPreKeySignature(request.getSignedPreKeySignature());
        
        try {
            String opksJson = objectMapper.writeValueAsString(request.getOneTimePreKeys());
            user.setOneTimePreKeysJson(opksJson);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize one-time pre-keys");
        }
        
        userRepository.save(user);
        log.info("Key bundle uploaded for user {}, OPK count: {}",
                user.getId(), request.getOneTimePreKeys().size());
    }

    @Transactional
    public KeyBundleResponse fetchKeyBundle(UUID requesterId, UUID recipientId) {
        // Only allow key bundle fetches between users who share a chat
        chatRepository.findByParticipants(requesterId, recipientId)
                .orElseThrow(() -> new RuntimeException("Key bundle not available"));

        User recipient = userRepository.findById(recipientId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (recipient.getIdentityPublicKey() == null) {
            throw new RuntimeException("Recipient has not set up E2EE keys yet");
        }

        Integer opkId = null;
        String opkPublic = null;

        if (recipient.getOneTimePreKeysJson() != null) {
            try {
                List<Map<String, Object>> opks = objectMapper.readValue(
                        recipient.getOneTimePreKeysJson(),
                        new TypeReference<>() {
                        });

                if (!opks.isEmpty()) {

                    Map<String, Object> opk = opks.removeFirst();
                    opkId = (Integer) opk.get("keyId");
                    opkPublic = (String) opk.get("publicKey");

                    recipient.setOneTimePreKeysJson(
                            objectMapper.writeValueAsString(opks));
                    userRepository.save(recipient);

                    log.info("OPK consumed for recipient {}, remaining: {}",
                            recipientId, opks.size());

                    // Notify the recipient to replenish if running low
                    if (opks.size() < LOW_OPK_THRESHOLD) {
                        notifyLowOpks(recipient, opks.size());
                    }
                }
            } catch (JsonProcessingException e) {
                log.error("Failed to parse OPKs for user {}: {}", recipientId, e.getMessage());
            }
        }
        return KeyBundleResponse.builder()
                .recipientId(recipientId.toString())
                .identityPublicKey(recipient.getIdentityPublicKey())
                .signedPreKyPublic(recipient.getSignedPreKeyPublic())
                .signedPreKeySignature(recipient.getSignedPreKeySignature())
                .oneTimePreKeyId(String.valueOf(opkId))
                .oneTimePreKeyPublic(opkPublic)
                .build();
    }

    @Transactional
    public int replenishOtpks(User user, OtpkReplenishRequest request) {
        List<Map<String, Object>> existing = new ArrayList<>();

        if(user.getOneTimePreKeysJson() != null) {
            try {
                existing = objectMapper.readValue(
                        user.getOneTimePreKeysJson(),
                        new TypeReference<>() {});
            } catch (JsonProcessingException e) {
                log.warn("Failed to parse existing OPKs, starting fresh");
            }
        }

        for (KeyBundleUploadRequest.OneTimePreKey opk : request.getOneTimePreKeys()) {
            Map<String, Object> opkMap = new HashMap<>();
            opkMap.put("keyId", opk.getKeyId());
            opkMap.put("publicKey", opk.getPublicKey());
            existing.add(opkMap);
        }

        try {
                user.setOneTimePreKeysJson(objectMapper.writeValueAsString(existing));
                userRepository.save(user);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize OPKs");
        }

        log.info("OPKs replenished for user {}, total now: {}",
                user.getId(), existing.size());
        return existing.size();

    }

    public int getOpkCount(User user) {
        if (user.getOneTimePreKeysJson() == null) return 0;
        try {
            List<?> opks = objectMapper.readValue(
                    user.getOneTimePreKeysJson(), List.class);
            return opks.size();
        } catch (JsonProcessingException e) {
            return 0;
        }
    }

    private void notifyLowOpks(User recipient, int remaining) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("message", "One-time pre-keys running low");
            payload.put("remaining", remaining);
            payload.put("threshold", LOW_OPK_THRESHOLD);

            webSocketPublisher.publishNotification(
                    recipient.getId(),
                    WebSocketEventType.NOTIFICATION_NEW,
                    payload);

            log.info("Notified user {} to replenish OPKs (remaining: {})",
                    recipient.getId(), remaining);
        } catch (Exception e) {
            log.error("Failed to notify user {} of low OPKs: {}",
                    recipient.getId(), e.getMessage());
        }
    }
}
