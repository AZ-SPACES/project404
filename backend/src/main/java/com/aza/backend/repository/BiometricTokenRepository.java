package com.aza.backend.repository;

import com.aza.backend.entity.BiometricToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BiometricTokenRepository extends JpaRepository<BiometricToken, UUID> {

    Optional<BiometricToken> findByTokenHash(String tokenHash);

    List<BiometricToken> findAllByUserId(UUID userId);

    Optional<BiometricToken> findByUserIdAndDeviceId(UUID userId, String deviceId);

    void deleteAllByUserId(UUID userId);
}
