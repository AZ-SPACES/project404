package com.aza.backend.repository;

import com.aza.backend.entity.ScreeningMatch;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface ScreeningMatchRepository extends JpaRepository<ScreeningMatch, UUID> {

    Page<ScreeningMatch> findByStatusOrderByMatchScoreDescCreatedAtDesc(
            ScreeningMatch.Status status, Pageable pageable);

    Page<ScreeningMatch> findAllByOrderByCreatedAtDesc(Pageable pageable);

    boolean existsByUserIdAndListEntryId(UUID userId, UUID listEntryId);

    long countByStatus(ScreeningMatch.Status status);
}
