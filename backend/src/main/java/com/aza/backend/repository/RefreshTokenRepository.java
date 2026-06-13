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
    Optional<RefreshToken> findByAccessTokenHash(String accessTokenHash);

    List<RefreshToken> findAllByUserId(UUID userId);
    long countByUserId(UUID userId);

    Optional<RefreshToken> findByIdAndUserId(UUID id, UUID userId);
    Optional<RefreshToken> findByUserIdAndDeviceId(UUID userId, String deviceId);

    void deleteAllByUserId(UUID userId);

    void deleteByTokenHash(String tokenHash);
    void deleteByAccessTokenHash(String accessTokenHash);

    void deleteByExpiresAtBefore(java.time.LocalDateTime cutoff);

    List<RefreshToken> findAllByDeviceId(String deviceId);

    /** One row per distinct device_id — the most-recently-used session for each device. */
    @Query(value = "SELECT DISTINCT ON (r.device_id) r.* FROM refresh_tokens r " +
                   "WHERE r.device_id IS NOT NULL ORDER BY r.device_id, r.last_used_at DESC",
           countQuery = "SELECT COUNT(DISTINCT device_id) FROM refresh_tokens WHERE device_id IS NOT NULL",
           nativeQuery = true)
    org.springframework.data.domain.Page<RefreshToken> findLatestSessionPerDevice(
            org.springframework.data.domain.Pageable pageable);

    /** Devices that have been used by more than {@code threshold} distinct user accounts. */
    @Query(value = "SELECT r.device_id, r.device_name, r.device_os, COUNT(DISTINCT r.user_id) AS user_count, " +
                   "MAX(r.last_used_at) AS last_seen " +
                   "FROM refresh_tokens r WHERE r.device_id IS NOT NULL " +
                   "GROUP BY r.device_id, r.device_name, r.device_os " +
                   "HAVING COUNT(DISTINCT r.user_id) > :threshold " +
                   "ORDER BY COUNT(DISTINCT r.user_id) DESC",
           nativeQuery = true)
    java.util.List<Object[]> findMultiUserDevices(@Param("threshold") long threshold);

    /**
     * Sets the resolved location for a session without touching other columns.
     * Used by the async geo lookup so it doesn't bump {@code lastUsedAt} via @UpdateTimestamp.
     */
    @Modifying
    @Transactional
    @Query("UPDATE RefreshToken r SET r.location = :location WHERE r.id = :id")
    void updateLocation(@Param("id") UUID id, @Param("location") String location);
}
