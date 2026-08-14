package com.aza.backend.repository;

import com.aza.backend.entity.RedEnvelope;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RedEnvelopeRepository extends JpaRepository<RedEnvelope, UUID> {

    Optional<RedEnvelope> findByClaimCode(String claimCode);

    /**
     * The open path. A gift has one recipient, so there is no race between rival
     * claimants — but there is one between a recipient's own double-tap and a retry, and
     * paying a gift out twice is exactly as bad. The read of the status and the write
     * that credits the wallet have to be a single serialised step.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT e FROM RedEnvelope e WHERE e.claimCode = :claimCode")
    Optional<RedEnvelope> findByClaimCodeForUpdate(@Param("claimCode") String claimCode);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT e FROM RedEnvelope e WHERE e.id = :id")
    Optional<RedEnvelope> findByIdForUpdate(@Param("id") UUID id);

    Page<RedEnvelope> findAllBySenderIdOrderByCreatedAtDesc(UUID senderId, Pageable pageable);

    Page<RedEnvelope> findAllByRecipientIdOrderByCreatedAtDesc(UUID recipientId, Pageable pageable);

    @Query("SELECT e FROM RedEnvelope e WHERE e.status = com.aza.backend.entity.RedEnvelope.Status.UNOPENED "
            + "AND e.expiresAt <= :now")
    List<RedEnvelope> findExpired(@Param("now") LocalDateTime now);

    /**
     * Money sitting in unopened gifts: debited from a sender, credited to nobody. The
     * safeguarding snapshot counts it for the same reason it counts held payments —
     * leaving it out would make every unopened gift look like a surplus and hide a real
     * breach of exactly that size.
     */
    @Query("SELECT COALESCE(SUM(e.amount - e.refundedAmount), 0) FROM RedEnvelope e "
            + "WHERE e.status = com.aza.backend.entity.RedEnvelope.Status.UNOPENED")
    BigDecimal sumOpenEnvelopeFloat();
}
