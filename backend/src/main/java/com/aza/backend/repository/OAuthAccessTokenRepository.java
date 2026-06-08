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
}
