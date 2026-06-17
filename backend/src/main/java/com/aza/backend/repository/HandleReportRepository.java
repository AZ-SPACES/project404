package com.aza.backend.repository;

import com.aza.backend.entity.HandleReport;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.UUID;

public interface HandleReportRepository extends JpaRepository<HandleReport, UUID> {
    Page<HandleReport> findByStatus(HandleReport.ReportStatus status, Pageable pageable);
    long countByStatus(HandleReport.ReportStatus status);

    /** Guards against a single user spamming reports for the same handle in a short window. */
    long countByReportedByUserIdAndReportedHandleAndCreatedAtAfter(
            UUID reportedByUserId, String reportedHandle, LocalDateTime after);
}
