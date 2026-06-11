package com.aza.backend.repository;

import com.aza.backend.entity.HistoryTransferChunk;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface HistoryTransferChunkRepository extends JpaRepository<HistoryTransferChunk, UUID> {

    Optional<HistoryTransferChunk> findByTransferIdAndSeq(UUID transferId, int seq);

    long countByTransferId(UUID transferId);

    void deleteByTransferId(UUID transferId);
}
