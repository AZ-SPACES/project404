package com.aza.backend.repository;

import com.aza.backend.entity.ExpenseSplitParticipant;
import org.springframework.data.jpa.repository.JpaRepository;
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
}
