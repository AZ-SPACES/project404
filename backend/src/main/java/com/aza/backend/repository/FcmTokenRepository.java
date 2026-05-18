package com.aza.backend.repository;

import com.aza.backend.entity.FcmToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface FcmTokenRepository extends JpaRepository<FcmToken, UUID>{
    List<FcmToken> findAllByUserId(UUID userId);

    Optional<FcmToken> findByToken(String token);

    void deleteAllByToken(String token);

    void deleteAllByUserId(UUID userId);

    Optional<FcmToken> findByUserIdAndDeviceId(UUID userId, String deviceId);
}
