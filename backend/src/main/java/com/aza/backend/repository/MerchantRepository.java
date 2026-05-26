package com.aza.backend.repository;

import com.aza.backend.entity.Merchant;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface MerchantRepository extends JpaRepository<Merchant, UUID> {

    Optional<Merchant> findByUserId(UUID userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT m FROM Merchant m WHERE m.id = :id")
    Optional<Merchant> findByIdForUpdate(@Param("id") UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT m FROM Merchant m WHERE m.userId = :userId")
    Optional<Merchant> findByUserIdForUpdate(@Param("userId") UUID userId);

    Optional<Merchant> findByBusinessHandle(String businessHandle);

    boolean existsByBusinessHandle(String businessHandle);

    @Query("""
            SELECT m FROM Merchant m
            WHERE (:status IS NULL OR m.status = :status)
            AND (:query IS NULL OR LOWER(m.businessName) LIKE LOWER(CONCAT('%', :query, '%'))
                 OR LOWER(m.businessHandle) LIKE LOWER(CONCAT('%', :query, '%')))
            """)
    Page<Merchant> search(
            @Param("query") String query,
            @Param("status") Merchant.MerchantStatus status,
            Pageable pageable);
}
