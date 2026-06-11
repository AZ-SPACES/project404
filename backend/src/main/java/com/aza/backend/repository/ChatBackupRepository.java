package com.aza.backend.repository;

import com.aza.backend.entity.ChatBackup;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ChatBackupRepository extends JpaRepository<ChatBackup, UUID> {

    Optional<ChatBackup> findByIdAndUserId(UUID id, UUID userId);

    Optional<ChatBackup> findFirstByUserIdAndStatusOrderByUpdatedAtDesc(
            UUID userId, ChatBackup.Status status);

    List<ChatBackup> findByUserId(UUID userId);
}
