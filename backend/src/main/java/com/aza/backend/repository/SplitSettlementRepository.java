package com.aza.backend.repository;

import com.aza.backend.entity.SplitSettlement;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SplitSettlementRepository extends JpaRepository<SplitSettlement, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM SplitSettlement s WHERE s.id = :id")
    Optional<SplitSettlement> findByIdForUpdate(@Param("id") UUID id);

    /**
     * An outstanding settlement between two people, whichever way round it points.
     * Only one may be open at a time — a second would net debts the first already took.
     */
    @Query("SELECT s FROM SplitSettlement s WHERE s.status = com.aza.backend.entity.SplitSettlement.Status.PENDING "
            + "AND ((s.creditorId = :a AND s.debtorId = :b) OR (s.creditorId = :b AND s.debtorId = :a))")
    List<SplitSettlement> findOpenBetween(@Param("a") UUID a, @Param("b") UUID b);
}
