package com.aza.backend.repository;

import com.aza.backend.entity.ChatBackupChunk;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ChatBackupChunkRepository extends JpaRepository<ChatBackupChunk, UUID> {

    Optional<ChatBackupChunk> findByBackupIdAndSeq(UUID backupId, int seq);

    long countByBackupId(UUID backupId);

    void deleteByBackupId(UUID backupId);
}
