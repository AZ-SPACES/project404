package com.aza.backend.service;

import com.aza.backend.dto.MiniAppReportRequest;
import com.aza.backend.dto.admin.MiniAppReportResponse;
import com.aza.backend.dto.admin.MiniAppReportStatsResponse;
import com.aza.backend.entity.MiniAppReport;
import com.aza.backend.entity.User;
import com.aza.backend.repository.MiniAppReportRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MiniAppReportService {

    private final MiniAppReportRepository repository;

    public void createReport(String appId, MiniAppReportRequest request, User reporter) {
        MiniAppReport.ReportReason reason;
        try {
            reason = MiniAppReport.ReportReason.valueOf(request.getReason());
        } catch (Exception e) {
            reason = MiniAppReport.ReportReason.OTHER;
        }

        MiniAppReport report = MiniAppReport.builder()
                .appId(appId)
                .reportedByUserId(reporter.getId())
                .reportedByHandle(reporter.getHandle())
                .reason(reason)
                .details(request.getDetails())
                .build();

        repository.save(report);
    }

    public Page<MiniAppReportResponse> getReports(int page, int size, String status) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<MiniAppReport> reports = (status != null && !status.isBlank())
                ? repository.findByStatus(MiniAppReport.ReportStatus.valueOf(status), pageable)
                : repository.findAll(pageable);
        return reports.map(this::toResponse);
    }

    public MiniAppReportResponse resolve(UUID id, String action, String resolution, User admin) {
        MiniAppReport report = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Report not found"));

        report.setStatus("DISMISS".equals(action)
                ? MiniAppReport.ReportStatus.DISMISSED
                : MiniAppReport.ReportStatus.RESOLVED);
        report.setResolution(resolution);
        report.setResolvedBy(admin.getId());
        report.setResolvedAt(LocalDateTime.now());

        return toResponse(repository.save(report));
    }

    public MiniAppReportStatsResponse getStats() {
        long open = repository.countByStatus(MiniAppReport.ReportStatus.OPEN);
        long resolved = repository.countByStatus(MiniAppReport.ReportStatus.RESOLVED);
        long dismissed = repository.countByStatus(MiniAppReport.ReportStatus.DISMISSED);
        return MiniAppReportStatsResponse.builder()
                .total(open + resolved + dismissed)
                .open(open)
                .resolved(resolved)
                .dismissed(dismissed)
                .build();
    }

    private MiniAppReportResponse toResponse(MiniAppReport r) {
        return MiniAppReportResponse.builder()
                .id(r.getId().toString())
                .appId(r.getAppId())
                .reportedByUserId(r.getReportedByUserId().toString())
                .reportedByHandle(r.getReportedByHandle())
                .reason(r.getReason().name())
                .details(r.getDetails())
                .status(r.getStatus().name())
                .resolution(r.getResolution())
                .createdAt(r.getCreatedAt())
                .resolvedAt(r.getResolvedAt())
                .build();
    }
}
