package com.aza.backend.service;

import com.aza.backend.dto.ReportHandleRequest;
import com.aza.backend.entity.HandleReport;
import com.aza.backend.entity.User;
import com.aza.backend.repository.HandleReportRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

/**
 * Records user reports against payment handles / store codes for the back-office
 * screening queue. Named distinctly from the analytics-focused {@code ReportService}.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class HandleReportService {

    private final HandleReportRepository repository;

    public void createReport(ReportHandleRequest request, User reporter) {
        if (request.getHandle() == null || request.getHandle().isBlank()) {
            throw new IllegalArgumentException("A handle is required to file a report.");
        }
        String handle = request.getHandle().trim().replaceFirst("^@", "");

        // Light anti-spam: ignore repeat reports of the same handle by the same
        // user within an hour so a frustrated tap doesn't flood the queue.
        long recent = repository.countByReportedByUserIdAndReportedHandleAndCreatedAtAfter(
                reporter.getId(), handle, LocalDateTime.now().minusHours(1));
        if (recent > 0) {
            log.debug("Skipping duplicate handle report for {} by {}", handle, reporter.getId());
            return;
        }

        HandleReport.ReportReason reason;
        try {
            reason = HandleReport.ReportReason.valueOf(
                    request.getReason() == null ? "OTHER" : request.getReason().trim().toUpperCase());
        } catch (Exception e) {
            reason = HandleReport.ReportReason.OTHER;
        }

        HandleReport report = HandleReport.builder()
                .reportedHandle(handle)
                .reportedByUserId(reporter.getId())
                .reportedByHandle(reporter.getUsername())
                .reason(reason)
                .details(request.getDetails())
                .build();

        repository.save(report);
        log.info("Handle report filed: handle={} reason={} by={}", handle, reason, reporter.getId());
    }
}
