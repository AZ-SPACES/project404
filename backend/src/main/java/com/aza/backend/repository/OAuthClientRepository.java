package com.aza.backend.repository;

import com.aza.backend.entity.OAuthClient;
import com.aza.backend.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OAuthClientRepository extends JpaRepository<OAuthClient, UUID> {
    Optional<OAuthClient> findByClientId(String clientId);
    Optional<OAuthClient> findByClientIdAndActiveTrue(String clientId);
    List<OAuthClient> findByOwnerOrderByCreatedAtDesc(User owner);
    boolean existsByClientIdAndOwner(String clientId, User owner);

    long countByActiveTrue();
    long countByActiveFalse();

    @Query("""
        SELECT c FROM OAuthClient c
        WHERE (:query IS NULL OR LOWER(c.appName) LIKE LOWER(CONCAT('%', :query, '%'))
               OR LOWER(c.clientId) LIKE LOWER(CONCAT('%', :query, '%')))
          AND (:active IS NULL OR c.active = :active)
        ORDER BY c.createdAt DESC
        """)
    Page<OAuthClient> adminSearch(String query, Boolean active, Pageable pageable);
}
