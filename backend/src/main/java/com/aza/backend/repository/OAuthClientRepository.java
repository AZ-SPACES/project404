package com.aza.backend.repository;

import com.aza.backend.entity.OAuthClient;
import com.aza.backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OAuthClientRepository extends JpaRepository<OAuthClient, UUID> {
    Optional<OAuthClient> findByClientId(String clientId);
    Optional<OAuthClient> findByClientIdAndActiveTrue(String clientId);
    List<OAuthClient> findByOwnerOrderByCreatedAtDesc(User owner);
    boolean existsByClientIdAndOwner(String clientId, User owner);
}
