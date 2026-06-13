package com.aza.backend.service;

import com.aza.backend.entity.AuditLog;
import com.aza.backend.entity.DeviceBlock;
import com.aza.backend.entity.RefreshToken;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.DeviceBlockRepository;
import com.aza.backend.repository.RefreshTokenRepository;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DeviceService {

    static final String DEVICE_BLOCK_PREFIX = "deviceblock:";
    private static final String BLACKLIST_PREFIX = "jwt:blacklist:";

    private final DeviceBlockRepository deviceBlockRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final AuditService auditService;
    private final StringRedisTemplate redisTemplate;

    // ── Device registry ───────────────────────────────────────────────────────

    public Page<DeviceRegistryRow> getDeviceRegistry(int page, int size) {
        Page<RefreshToken> raw = refreshTokenRepository.findLatestSessionPerDevice(
                PageRequest.of(page, size));
        return raw.map(r -> DeviceRegistryRow.builder()
                .deviceId(r.getDeviceId())
                .deviceName(r.getDeviceName())
                .deviceOs(r.getDeviceOs())
                .location(r.getLocation())
                .lastSeenAt(r.getLastUsedAt() != null ? r.getLastUsedAt() : r.getCreatedAt())
                .blocked(deviceBlockRepository.existsByDeviceId(r.getDeviceId()))
                .build());
    }

    public List<SuspiciousDeviceRow> getSuspiciousDevices(long threshold) {
        List<Object[]> rows = refreshTokenRepository.findMultiUserDevices(threshold);
        return rows.stream().map(r -> SuspiciousDeviceRow.builder()
                .deviceId((String) r[0])
                .deviceName((String) r[1])
                .deviceOs((String) r[2])
                .userCount(((Number) r[3]).longValue())
                .lastSeenAt(r[4] != null ? ((java.sql.Timestamp) r[4]).toLocalDateTime() : null)
                .blocked(deviceBlockRepository.existsByDeviceId((String) r[0]))
                .build()).toList();
    }

    // ── Block / unblock ───────────────────────────────────────────────────────

    @Transactional
    public DeviceBlock blockDevice(User admin, String deviceId, UUID associatedUserId,
                                   String deviceName, String deviceOs, String reason) {
        if (deviceBlockRepository.existsByDeviceId(deviceId)) {
            throw new AppException("ALREADY_BLOCKED", "Device is already blocked", HttpStatus.CONFLICT);
        }

        DeviceBlock block = DeviceBlock.builder()
                .deviceId(deviceId)
                .deviceName(deviceName)
                .deviceOs(deviceOs)
                .associatedUserId(associatedUserId)
                .reason(reason)
                .blockedByEmail(admin.getEmail())
                .build();
        deviceBlockRepository.save(block);

        // Persist in Redis so the login/refresh path can do an O(1) check.
        redisTemplate.opsForValue().set(DEVICE_BLOCK_PREFIX + deviceId, "blocked");

        // Kill every live session on this device immediately.
        List<RefreshToken> sessions = refreshTokenRepository.findAllByDeviceId(deviceId);
        for (RefreshToken rt : sessions) {
            if (rt.getAccessTokenHash() != null && rt.getAccessTokenExpiresAt() != null) {
                Duration remaining = Duration.between(LocalDateTime.now(), rt.getAccessTokenExpiresAt());
                if (!remaining.isNegative() && !remaining.isZero()) {
                    redisTemplate.opsForValue().set(
                            BLACKLIST_PREFIX + rt.getAccessTokenHash(), "device-blocked", remaining);
                }
            }
        }
        refreshTokenRepository.deleteAll(sessions);

        auditService.logWithDetails("DEVICE_BLOCK", com.aza.backend.entity.AuditLog.SUCCESS,
                admin.getId(), admin.getEmail(), null, "deviceId=" + deviceId + " reason=" + reason);
        return block;
    }

    @Transactional
    public void unblockDevice(User admin, String deviceId) {
        if (!deviceBlockRepository.existsByDeviceId(deviceId)) {
            throw new AppException("NOT_FOUND", "Device block not found", HttpStatus.NOT_FOUND);
        }
        deviceBlockRepository.deleteByDeviceId(deviceId);
        redisTemplate.delete(DEVICE_BLOCK_PREFIX + deviceId);
        auditService.logWithDetails("DEVICE_UNBLOCK", com.aza.backend.entity.AuditLog.SUCCESS,
                admin.getId(), admin.getEmail(), null, "deviceId=" + deviceId);
    }

    public List<DeviceBlock> listBlocked() {
        return deviceBlockRepository.findAllByOrderByBlockedAtDesc();
    }

    /** Called by the auth layer — Redis-only, no DB hit. */
    public boolean isDeviceBlocked(String deviceId) {
        if (deviceId == null || deviceId.isBlank()) return false;
        return Boolean.TRUE.equals(redisTemplate.hasKey(DEVICE_BLOCK_PREFIX + deviceId));
    }

    // ── DTOs ─────────────────────────────────────────────────────────────────

    @Data @Builder
    public static class DeviceRegistryRow {
        private String deviceId;
        private String deviceName;
        private String deviceOs;
        private String location;
        private LocalDateTime lastSeenAt;
        private boolean blocked;
    }

    @Data @Builder
    public static class SuspiciousDeviceRow {
        private String deviceId;
        private String deviceName;
        private String deviceOs;
        private long userCount;
        private LocalDateTime lastSeenAt;
        private boolean blocked;
    }
}
