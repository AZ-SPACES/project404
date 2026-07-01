package com.aza.backend.repository;

import com.aza.backend.entity.CheckoutSessionSplit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CheckoutSessionSplitRepository extends JpaRepository<CheckoutSessionSplit, UUID> {

    List<CheckoutSessionSplit> findAllBySessionId(UUID sessionId);
}
