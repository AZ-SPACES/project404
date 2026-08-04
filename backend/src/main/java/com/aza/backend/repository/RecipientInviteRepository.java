package com.aza.backend.repository;

import com.aza.backend.entity.RecipientInvite;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RecipientInviteRepository extends JpaRepository<RecipientInvite, UUID> {

    Optional<RecipientInvite> findByMerchantIdAndIdentifier(UUID merchantId, String identifier);

    /** Signup fulfilment: every merchant waiting on this person. */
    List<RecipientInvite> findAllByIdentifierAndStatus(String identifier, RecipientInvite.Status status);

    Page<RecipientInvite> findAllByMerchantIdOrderByCreatedAtDesc(UUID merchantId, Pageable pageable);

    long countByMerchantIdAndStatus(UUID merchantId, RecipientInvite.Status status);
}
