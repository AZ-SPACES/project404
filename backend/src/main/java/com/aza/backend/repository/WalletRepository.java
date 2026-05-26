package com.aza.backend.repository;

import com.aza.backend.entity.Wallet;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface WalletRepository extends JpaRepository<Wallet, UUID> {

    Optional<Wallet> findByUserId(UUID userId);

    /**
     * Pessimistic lock — prevents two transfers from reading the same
     * balance at the same time (race condition protection)
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT w FROM Wallet w WHERE w.userId = :userId")
    Optional<Wallet> findByUserIdForUpdate(UUID userId);

    @Query("SELECT COALESCE(SUM(w.balance), 0) FROM Wallet w")
    java.math.BigDecimal sumTotalBalance();
}
