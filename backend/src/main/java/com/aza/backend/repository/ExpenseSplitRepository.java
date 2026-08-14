package com.aza.backend.repository;

import com.aza.backend.entity.ExpenseSplit;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ExpenseSplitRepository extends JpaRepository<ExpenseSplit, UUID> {

    /**
     * The rollup path. Two shares of the same split can settle at the same moment, and
     * both then ask "was that the last one?" — the answer has to be decided by one of
     * them at a time or the split never flips to SETTLED.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM ExpenseSplit s WHERE s.id = :id")
    Optional<ExpenseSplit> findByIdForUpdate(@Param("id") UUID id);

    Optional<ExpenseSplit> findByCreatorIdAndIdempotencyKey(UUID creatorId, String idempotencyKey);

    /**
     * Every split the user is in — the ones they are owed for and the ones they owe on,
     * newest first.
     */
    @Query("SELECT s FROM ExpenseSplit s WHERE s.id IN "
            + "(SELECT p.splitId FROM ExpenseSplitParticipant p WHERE p.userId = :userId) "
            + "ORDER BY s.createdAt DESC")
    Page<ExpenseSplit> findAllForUser(@Param("userId") UUID userId, Pageable pageable);
}
