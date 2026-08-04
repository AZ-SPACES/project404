package com.aza.backend.repository;

import com.aza.backend.entity.HoldRecipient;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface HoldRecipientRepository extends JpaRepository<HoldRecipient, UUID> {

    List<HoldRecipient> findAllByHoldId(UUID holdId);
}
