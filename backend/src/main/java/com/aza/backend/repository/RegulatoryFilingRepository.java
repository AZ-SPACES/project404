package com.aza.backend.repository;

import com.aza.backend.entity.RegulatoryFiling;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RegulatoryFilingRepository extends JpaRepository<RegulatoryFiling, UUID> {

    List<RegulatoryFiling> findAllByOrderByFiledAtDesc();

    List<RegulatoryFiling> findAllByTypeOrderByFiledAtDesc(RegulatoryFiling.FilingType type);
}
