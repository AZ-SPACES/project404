package com.aza.backend.repository;

import com.aza.backend.entity.MiniAppReport;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface MiniAppReportRepository extends JpaRepository<MiniAppReport, UUID> {
    Page<MiniAppReport> findByStatus(MiniAppReport.ReportStatus status, Pageable pageable);
    long countByStatus(MiniAppReport.ReportStatus status);
}
