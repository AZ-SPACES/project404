package com.aza.backend.repository;

import com.aza.backend.entity.ExpenseSplitParticipant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ExpenseSplitParticipantRepository extends JpaRepository<ExpenseSplitParticipant, UUID> {

    List<ExpenseSplitParticipant> findAllBySplitIdOrderByCreatedAtAsc(UUID splitId);

    List<ExpenseSplitParticipant> findAllBySplitIdIn(List<UUID> splitIds);

    Optional<ExpenseSplitParticipant> findBySplitIdAndUserId(UUID splitId, UUID userId);

    Optional<ExpenseSplitParticipant> findByRequestTransactionId(UUID requestTransactionId);

    List<ExpenseSplitParticipant> findAllBySettlementId(UUID settlementId);

    /**
     * Shares one person still owes another, across every open split between them.
     *
     * The organiser of a split is the one owed, so "who owes whom" is a join away rather
     * than a column — which is exactly what makes netting possible without a second
     * ledger of balances.
     */
    @Query("SELECT p FROM ExpenseSplitParticipant p, ExpenseSplit s "
            + "WHERE p.splitId = s.id AND s.creatorId = :creditorId AND p.userId = :debtorId "
            + "AND p.organiser = false "
            + "AND p.status = com.aza.backend.entity.ExpenseSplitParticipant.Status.PENDING "
            + "AND s.status = com.aza.backend.entity.ExpenseSplit.Status.OPEN")
    List<ExpenseSplitParticipant> findOutstanding(@Param("creditorId") UUID creditorId,
                                                  @Param("debtorId") UUID debtorId);

    /** Everything the user still owes anyone, so their side of every balance can be summed. */
    @Query("SELECT s.creatorId, p FROM ExpenseSplitParticipant p, ExpenseSplit s "
            + "WHERE p.splitId = s.id AND p.userId = :userId AND p.organiser = false "
            + "AND p.status = com.aza.backend.entity.ExpenseSplitParticipant.Status.PENDING "
            + "AND s.status = com.aza.backend.entity.ExpenseSplit.Status.OPEN")
    List<Object[]> findAllOwedByUser(@Param("userId") UUID userId);

    /** Everything anyone still owes the user. */
    @Query("SELECT p.userId, p FROM ExpenseSplitParticipant p, ExpenseSplit s "
            + "WHERE p.splitId = s.id AND s.creatorId = :userId AND p.organiser = false "
            + "AND p.status = com.aza.backend.entity.ExpenseSplitParticipant.Status.PENDING "
            + "AND s.status = com.aza.backend.entity.ExpenseSplit.Status.OPEN")
    List<Object[]> findAllOwedToUser(@Param("userId") UUID userId);
}
