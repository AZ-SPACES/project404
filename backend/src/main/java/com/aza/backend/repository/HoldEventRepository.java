package com.aza.backend.repository;

import com.aza.backend.entity.HoldEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface HoldEventRepository extends JpaRepository<HoldEvent, UUID> {

    List<HoldEvent> findAllByHoldIdOrderByCreatedAtAsc(UUID holdId);

    /** Replay lookup: a release/refund retried with the same Idempotency-Key returns the original outcome. */
    Optional<HoldEvent> findByHoldIdAndIdempotencyKey(UUID holdId, String idempotencyKey);
}
