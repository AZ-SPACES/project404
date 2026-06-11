package com.aza.backend.service;

import com.aza.backend.dto.MiniAppReportRequest;
import com.aza.backend.dto.admin.DisabledMiniAppResponse;
import com.aza.backend.dto.admin.MiniAppReportResponse;
import com.aza.backend.dto.admin.MiniAppReportStatsResponse;
import com.aza.backend.entity.DisabledMiniApp;
import com.aza.backend.entity.MiniAppReport;
import com.aza.backend.entity.Notification;
import com.aza.backend.entity.User;
import com.aza.backend.repository.DisabledMiniAppRepository;
import com.aza.backend.repository.MiniAppReportRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class MiniAppReportService {

    private final MiniAppReportRepository repository;
    private final DisabledMiniAppRepository disabledMiniAppRepository;
    private final NotificationService notificationService;

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
                .reportedByHandle(reporter.getUsername())
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

    public MiniAppReportResponse resolve(UUID id, String action, String resolution, boolean disableApp, User admin) {
        MiniAppReport report = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Report not found"));

        boolean dismissed = "DISMISS".equals(action);
        report.setStatus(dismissed
                ? MiniAppReport.ReportStatus.DISMISSED
                : MiniAppReport.ReportStatus.RESOLVED);
        report.setResolution(resolution);
        report.setResolvedBy(admin.getId());
        report.setResolvedAt(LocalDateTime.now());

        if (disableApp && !dismissed) {
            disableApp(report.getAppId(), resolution, admin);
        }

        notifyReporter(report, dismissed);

        return toResponse(repository.save(report));
    }

    private void notifyReporter(MiniAppReport report, boolean dismissed) {
        try {
            String title = "Your mini app report was reviewed";
            String body = dismissed
                    ? "We reviewed your report about \"" + report.getAppId() + "\" and found no action was needed. Thanks for helping keep Aza safe."
                    : "We reviewed your report about \"" + report.getAppId() + "\" and took action. Thanks for helping keep Aza safe.";
            notificationService.sendNotification(
                    report.getReportedByUserId(),
                    Notification.NotificationType.SYSTEM_BROADCAST,
                    title, body,
                    Map.of("type", "MINI_APP_REPORT_REVIEWED", "appId", report.getAppId()));
        } catch (Exception e) {
            // Resolution must not fail because the reporter couldn't be notified
            log.warn("Failed to notify reporter {} of mini app report resolution: {}",
                    report.getReportedByUserId(), e.getMessage());
        }
    }

    // ── Mini app kill switch ──────────────────────────────────────────────────

    public List<String> getDisabledAppIds() {
        return disabledMiniAppRepository.findAll().stream()
                .map(DisabledMiniApp::getAppId)
                .toList();
    }

    public List<DisabledMiniAppResponse> getDisabledApps() {
        return disabledMiniAppRepository.findAll().stream()
                .map(d -> DisabledMiniAppResponse.builder()
                        .appId(d.getAppId())
                        .reason(d.getReason())
                        .disabledBy(d.getDisabledBy().toString())
                        .disabledAt(d.getDisabledAt())
                        .build())
                .toList();
    }

    public DisabledMiniAppResponse disableApp(String appId, String reason, User admin) {
        DisabledMiniApp disabled = disabledMiniAppRepository.findById(appId)
                .orElseGet(() -> DisabledMiniApp.builder()
                        .appId(appId)
                        .disabledBy(admin.getId())
                        .build());
        disabled.setReason(reason);
        disabled.setDisabledBy(admin.getId());
        disabled = disabledMiniAppRepository.save(disabled);
        log.info("Mini app {} disabled by admin {}", appId, admin.getId());
        return DisabledMiniAppResponse.builder()
                .appId(disabled.getAppId())
                .reason(disabled.getReason())
                .disabledBy(disabled.getDisabledBy().toString())
                .disabledAt(disabled.getDisabledAt())
                .build();
    }

    public void enableApp(String appId) {
        disabledMiniAppRepository.deleteById(appId);
        log.info("Mini app {} re-enabled", appId);
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
