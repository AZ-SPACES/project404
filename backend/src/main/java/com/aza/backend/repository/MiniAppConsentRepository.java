package com.aza.backend.repository;

import com.aza.backend.entity.MiniAppConsent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface MiniAppConsentRepository extends JpaRepository<MiniAppConsent, UUID> {

    Optional<MiniAppConsent> findByUserIdAndAppId(UUID userId, String appId);

    boolean existsByUserIdAndAppId(UUID userId, String appId);

    void deleteByUserIdAndAppId(UUID userId, String appId);
}
