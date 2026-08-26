package com.aza.backend.repository;

import com.aza.backend.entity.UserWithdrawal;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface UserWithdrawalRepository extends JpaRepository<UserWithdrawal, UUID> {

    /**
     * Pessimistic lock on one withdrawal row, for the review path. Rejecting refunds the
     * reserved funds, and the PENDING check that guards it is a read-modify-write on this
     * row: two admins rejecting at the same moment would otherwise both pass the check and
     * refund the same reservation twice.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT w FROM UserWithdrawal w WHERE w.id = :id")
    Optional<UserWithdrawal> findByIdForUpdate(@Param("id") UUID id);

    /**
     * Replay lookup, scoped to the user. Scoping is the point: a globally unique key lets
     * one account's retry return another account's withdrawal.
     */
    Optional<UserWithdrawal> findByUserIdAndIdempotencyKey(UUID userId, String idempotencyKey);

    Page<UserWithdrawal> findAllByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);
    Page<UserWithdrawal> findAllByStatusOrderByCreatedAtDesc(UserWithdrawal.WithdrawalStatus status, Pageable pageable);
    Page<UserWithdrawal> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
