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

    long countByStatus(Merchant.MerchantStatus status);

    @Query("SELECT m FROM Merchant m WHERE m.status IN :statuses ORDER BY m.createdAt ASC")
    org.springframework.data.domain.Page<Merchant> findByStatusIn(
            @Param("statuses") java.util.List<Merchant.MerchantStatus> statuses,
            org.springframework.data.domain.Pageable pageable);

    @Query("SELECT COALESCE(SUM(m.totalVolume), 0) FROM Merchant m WHERE m.status = 'ACTIVE'")
    java.math.BigDecimal sumActiveMerchantVolume();

    @Query("SELECT COALESCE(SUM(m.balance), 0) FROM Merchant m")
    java.math.BigDecimal sumTotalMerchantBalance();

    @Query(value = """
            SELECT * FROM merchants
            WHERE (:status IS NULL OR status = CAST(:status AS varchar))
            AND (:query IS NULL
                 OR business_name ILIKE CONCAT('%', :query, '%')
                 OR business_handle ILIKE CONCAT('%', :query, '%'))
            """,
            countQuery = """
            SELECT COUNT(*) FROM merchants
            WHERE (:status IS NULL OR status = CAST(:status AS varchar))
            AND (:query IS NULL
                 OR business_name ILIKE CONCAT('%', :query, '%')
                 OR business_handle ILIKE CONCAT('%', :query, '%'))
            """,
            nativeQuery = true)
    Page<Merchant> search(
            @Param("query") String query,
            @Param("status") String status,
            Pageable pageable);
}
