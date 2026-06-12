package com.aza.backend.repository;

import com.aza.backend.entity.AuditAnchor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AuditAnchorRepository extends JpaRepository<AuditAnchor, UUID> {

    Optional<AuditAnchor> findByAnchorDate(LocalDate anchorDate);

    Optional<AuditAnchor> findFirstByOrderByAnchorDateDesc();

    List<AuditAnchor> findAllByOrderByAnchorDateAsc();

    List<AuditAnchor> findTop30ByOrderByAnchorDateDesc();
}
