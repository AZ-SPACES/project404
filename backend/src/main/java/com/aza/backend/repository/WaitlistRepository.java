package com.aza.backend.repository;

import com.aza.backend.entity.WaitlistEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

public interface WaitlistRepository extends JpaRepository<WaitlistEntry, UUID> {
    boolean existsByEmail(String email);

    @Modifying
    @Transactional
    @Query("UPDATE WaitlistEntry w SET w.confirmationSent = true WHERE w.id = :id")
    void markConfirmationSent(UUID id);

    java.util.Optional<WaitlistEntry> findByInviteCode(String inviteCode);

    java.util.List<WaitlistEntry> findAllByOrderByCreatedAtDesc(org.springframework.data.domain.Pageable pageable);
}
