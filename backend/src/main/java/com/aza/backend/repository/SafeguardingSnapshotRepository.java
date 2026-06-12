package com.aza.backend.repository;

import com.aza.backend.entity.SafeguardingSnapshot;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface SafeguardingSnapshotRepository extends JpaRepository<SafeguardingSnapshot, UUID> {

    Page<SafeguardingSnapshot> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Optional<SafeguardingSnapshot> findFirstByOrderByCreatedAtDesc();
}
