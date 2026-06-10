// ============================================================
// FILE: repository/RefreshTokenRepository.java
// ============================================================
package com.aza.backend.repository;

import com.aza.backend.entity.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

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

    /**
     * Sets the resolved location for a session without touching other columns.
     * Used by the async geo lookup so it doesn't bump {@code lastUsedAt} via @UpdateTimestamp.
     */
    @Modifying
    @Transactional
    @Query("UPDATE RefreshToken r SET r.location = :location WHERE r.id = :id")
    void updateLocation(@Param("id") UUID id, @Param("location") String location);
}
