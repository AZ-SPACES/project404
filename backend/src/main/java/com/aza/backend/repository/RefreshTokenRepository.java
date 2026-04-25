// ============================================================
// FILE: repository/RefreshTokenRepository.java
// ============================================================
package com.aza.backend.repository;

import com.aza.backend.entity.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    void deleteAllByUserId(UUID userId);

    void deleteByTokenHash(String tokenHash);
}
