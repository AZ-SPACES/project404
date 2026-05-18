// ============================================================
// FILE: repository/RefreshTokenRepository.java
// ============================================================
package com.aza.backend.repository;

import com.aza.backend.entity.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    List<RefreshToken> findAllByUserId(UUID userId);
    long countByUserId(UUID userId);

    Optional<RefreshToken> findByIdAndUserId(UUID id, UUID userId);
    Optional<RefreshToken> findByUserIdAndDeviceId(UUID userId, String deviceId);

    void deleteAllByUserId(UUID userId);

    void deleteByTokenHash(String tokenHash);
    void deleteByAccessTokenHash(String accessTokenHash);

    void deleteByExpiresAtBefore(java.time.LocalDateTime cutoff);
}
