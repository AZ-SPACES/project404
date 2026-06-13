package com.aza.backend.service;

import com.aza.backend.dto.MiniAppReportRequest;
import com.aza.backend.dto.MiniAppStatusResponse;
import com.aza.backend.dto.admin.AdminMiniAppResponse;
import com.aza.backend.dto.admin.BroadcastNotificationRequest;
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
    private final BroadcastNotificationService broadcastNotificationService;

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

    // ── Mini app status (kill switch + maintenance) ──────────────────────────

    public List<String> getDisabledAppIds() {
        return disabledMiniAppRepository.findAll().stream()
                .map(DisabledMiniApp::getAppId)
                .toList();
    }

    /** Public view for the mobile hub: every app that isn't fully active. */
    public List<MiniAppStatusResponse> getAppStatuses() {
        return disabledMiniAppRepository.findAll().stream()
                .map(d -> MiniAppStatusResponse.builder()
                        .appId(d.getAppId())
                        .status(d.getStatus().name())
                        .message(d.getStatus() == DisabledMiniApp.Status.MAINTENANCE ? d.getReason() : null)
                        .build())
                .toList();
    }

    /** Admin view: the full catalog with each app's current status. */
    public List<AdminMiniAppResponse> getAllAppsForAdmin() {
        Map<String, DisabledMiniApp> records = disabledMiniAppRepository.findAll().stream()
                .collect(java.util.stream.Collectors.toMap(DisabledMiniApp::getAppId, d -> d));
        return MiniAppCatalog.ALL.stream()
                .map(entry -> {
                    DisabledMiniApp d = records.get(entry.id());
                    return AdminMiniAppResponse.builder()
                            .appId(entry.id())
                            .name(entry.name())
                            .category(entry.category())
                            .description(entry.description())
                            .status(d == null ? "ACTIVE" : d.getStatus().name())
                            .reason(d == null ? null : d.getReason())
                            .statusSetBy(d == null ? null : d.getDisabledBy().toString())
                            .statusSetAt(d == null ? null : d.getDisabledAt())
                            .build();
                })
                .toList();
    }

    /**
     * Put an app under maintenance. Users are notified (push + in-app) so they
     * know the app is down on purpose; the message is shown in the app too.
     */
    public AdminMiniAppResponse setMaintenance(String appId, String message, User admin) {
        MiniAppCatalog.Entry entry = MiniAppCatalog.find(appId)
                .orElseThrow(() -> new IllegalArgumentException("Unknown mini app: " + appId));

        java.util.Optional<DisabledMiniApp> existing = disabledMiniAppRepository.findById(appId);
        boolean alreadyInMaintenance = existing
                .map(d -> d.getStatus() == DisabledMiniApp.Status.MAINTENANCE)
                .orElse(false);
        DisabledMiniApp record = existing
                .orElseGet(() -> DisabledMiniApp.builder().appId(appId).disabledBy(admin.getId()).build());
        record.setStatus(DisabledMiniApp.Status.MAINTENANCE);
        record.setReason(message);
        record.setDisabledBy(admin.getId());
        disabledMiniAppRepository.save(record);
        log.info("Mini app {} put under maintenance by admin {}", appId, admin.getId());

        if (!alreadyInMaintenance) {
            notifyAllUsers(entry.name() + " is under maintenance",
                    (message != null && !message.isBlank())
                            ? message
                            : "We're doing some maintenance on " + entry.name() + ". It will be back shortly.");
        }

        return getAllAppsForAdmin().stream()
                .filter(a -> a.getAppId().equals(appId)).findFirst().orElseThrow();
    }

    private void notifyAllUsers(String title, String body) {
        try {
            BroadcastNotificationRequest request = new BroadcastNotificationRequest();
            request.setTitle(title);
            request.setBody(body);
            request.setAudience("ALL");
            int sent = broadcastNotificationService.broadcast(request);
            log.info("Mini app status broadcast \"{}\" sent to {} users", title, sent);
        } catch (Exception e) {
            // A status change must not fail because the broadcast did
            log.warn("Failed to broadcast mini app status \"{}\": {}", title, e.getMessage());
        }
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
        disabled.setStatus(DisabledMiniApp.Status.DISABLED);
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

    /** Current status record, if the app isn't fully active. */
    public java.util.Optional<DisabledMiniApp> getStatusRecord(String appId) {
        return disabledMiniAppRepository.findById(appId);
    }

    public void enableApp(String appId) {
        boolean wasMaintenance = getStatusRecord(appId)
                .map(d -> d.getStatus() == DisabledMiniApp.Status.MAINTENANCE)
                .orElse(false);
        disabledMiniAppRepository.deleteById(appId);
        log.info("Mini app {} re-enabled", appId);
        if (wasMaintenance) {
            String name = MiniAppCatalog.displayName(appId);
            notifyAllUsers(name + " is back",
                    "Maintenance is complete — " + name + " is available again.");
        }
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
