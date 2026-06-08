package com.aza.backend.repository;

import com.aza.backend.entity.OAuthAccessToken;
import com.aza.backend.entity.OAuthClient;
import com.aza.backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OAuthAccessTokenRepository extends JpaRepository<OAuthAccessToken, UUID> {
    Optional<OAuthAccessToken> findByTokenHash(String tokenHash);
    Optional<OAuthAccessToken> findByRefreshTokenHash(String refreshTokenHash);
    List<OAuthAccessToken> findByUserAndClientAndRevokedFalse(User user, OAuthClient client);

    @Modifying
    @Query("UPDATE OAuthAccessToken t SET t.revoked = true WHERE t.user = :user AND t.client = :client")
    void revokeAllForUserAndClient(User user, OAuthClient client);

    @Query("SELECT DISTINCT t.client FROM OAuthAccessToken t WHERE t.user = :user AND t.revoked = false AND t.expiresAt > CURRENT_TIMESTAMP")
    List<OAuthClient> findActiveClientsByUser(User user);

    @Query("SELECT t FROM OAuthAccessToken t WHERE t.user = :user AND t.client = :client AND t.revoked = false ORDER BY t.createdAt DESC")
    List<OAuthAccessToken> findActiveByUserAndClient(User user, OAuthClient client);

    @Query("SELECT COUNT(t) FROM OAuthAccessToken t WHERE t.client = :client AND t.revoked = false AND t.expiresAt > CURRENT_TIMESTAMP")
    long countActiveByClient(OAuthClient client);

    @Query("SELECT COUNT(t) FROM OAuthAccessToken t WHERE t.revoked = false AND t.expiresAt > CURRENT_TIMESTAMP")
    long countAllActive();

    @Modifying
    @Query("UPDATE OAuthAccessToken t SET t.revoked = true WHERE t.client = :client")
    void revokeAllForClient(OAuthClient client);
}
