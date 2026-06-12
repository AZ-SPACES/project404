package com.aza.backend.repository;

import com.aza.backend.entity.SanctionsListEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SanctionsListEntryRepository extends JpaRepository<SanctionsListEntry, UUID> {

    List<SanctionsListEntry> findByActiveTrue();

    List<SanctionsListEntry> findAllByOrderByCreatedAtDesc();

    long countByActiveTrue();
}
