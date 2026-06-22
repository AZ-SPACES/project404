package com.aza.backend.repository;

import com.aza.backend.entity.Wallet;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface WalletRepository extends JpaRepository<Wallet, UUID> {

    /**
     * The user's everyday wallet. A user may now also hold an AGENT_FLOAT wallet,
     * so this is scoped to PERSONAL — every existing caller means the personal one.
     */
    @Query("SELECT w FROM Wallet w WHERE w.userId = :userId AND w.type = com.aza.backend.entity.Wallet.WalletType.PERSONAL")
    Optional<Wallet> findByUserId(UUID userId);

    /**
     * Pessimistic lock — prevents two transfers from reading the same
     * balance at the same time (race condition protection). PERSONAL wallet.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT w FROM Wallet w WHERE w.userId = :userId AND w.type = com.aza.backend.entity.Wallet.WalletType.PERSONAL")
    Optional<Wallet> findByUserIdForUpdate(UUID userId);

    /** Type-scoped lookup — used to reach an agent's AGENT_FLOAT wallet. */
    Optional<Wallet> findByUserIdAndType(UUID userId, Wallet.WalletType type);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT w FROM Wallet w WHERE w.userId = :userId AND w.type = :type")
    Optional<Wallet> findByUserIdAndTypeForUpdate(@Param("userId") UUID userId,
                                                  @Param("type") Wallet.WalletType type);

    @Query("SELECT COALESCE(SUM(w.balance), 0) FROM Wallet w")
    java.math.BigDecimal sumTotalBalance();

    @Query("SELECT COALESCE(SUM(w.balance), 0) FROM Wallet w WHERE w.frozen = false OR w.frozen IS NULL")
    java.math.BigDecimal sumAllBalances();

    @Query("SELECT COALESCE(SUM(w.balance), 0) FROM Wallet w")
    java.math.BigDecimal sumAllBalancesIncludingFrozen();

    /** Float held by agents in a given status — a breakdown of customer float for safeguarding reporting. */
    @Query("SELECT COALESCE(SUM(w.balance), 0) FROM Wallet w " +
            "WHERE w.type = com.aza.backend.entity.Wallet.WalletType.AGENT_FLOAT " +
            "AND w.userId IN (SELECT a.userId FROM Agent a WHERE a.status = :status)")
    java.math.BigDecimal sumFloatForAgentStatus(
            @Param("status") com.aza.backend.entity.Agent.Status status);
}
