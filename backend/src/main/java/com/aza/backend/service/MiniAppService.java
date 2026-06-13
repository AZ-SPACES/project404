package com.aza.backend.service;

import com.aza.backend.dto.miniapp.*;
import com.aza.backend.dto.transfer.TransferRequest;
import com.aza.backend.dto.transfer.TransferResponse;
import com.aza.backend.entity.MiniApp;
import com.aza.backend.entity.MiniApp.Permission;
import com.aza.backend.entity.MiniAppConsent;
import com.aza.backend.entity.Notification;
import com.aza.backend.entity.User;
import com.aza.backend.repository.MiniAppConsentRepository;
import com.aza.backend.repository.MiniAppRepository;
import com.aza.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class MiniAppService {

    private final MiniAppRepository miniAppRepository;
    private final MiniAppConsentRepository consentRepository;
    private final UserRepository userRepository;
    private final TransferService transferService;
    private final NotificationService notificationService;

    // ── Public registry ────────────────────────────────────────────────────

    public List<MiniAppRegistryEntry> getActiveApps() {
        return miniAppRepository.findAllByStatus(MiniApp.Status.ACTIVE)
                .stream().map(this::toRegistryEntry).toList();
    }

    // ── Developer API ──────────────────────────────────────────────────────

    public MiniAppDetailResponse saveApp(SubmitMiniAppRequest req, User developer) {
        if (miniAppRepository.existsById(req.getId())) {
            MiniApp existing = miniAppRepository.findById(req.getId()).orElseThrow();
            if (!existing.getSubmittedBy().equals(developer.getId())) {
                throw new IllegalArgumentException("App ID already taken");
            }
            // Only allow edits to non-active apps
            if (existing.getStatus() == MiniApp.Status.ACTIVE) {
                throw new IllegalStateException("Cannot edit a live app — suspend it first");
            }
            return saveOrUpdate(existing, req, developer);
        }
        MiniApp app = MiniApp.builder()
                .id(req.getId())
                .submittedBy(developer.getId())
                .build();
        return saveOrUpdate(app, req, developer);
    }

    private MiniAppDetailResponse saveOrUpdate(MiniApp app, SubmitMiniAppRequest req, User developer) {
        app.setName(req.getName());
        app.setDescription(req.getDescription());
        app.setCategory(req.getCategory());
        app.setIconUrl(req.getIconUrl());
        app.setUrl(req.getUrl());
        app.setDeveloperName(req.getDeveloperName());
        app.setSupportUrl(req.getSupportUrl());
        app.setVersion(req.getVersion());

        Set<Permission> permissions = req.getRequestedPermissions() == null
                ? Set.of()
                : req.getRequestedPermissions().stream()
                    .map(p -> {
                        try { return Permission.valueOf(p); }
                        catch (IllegalArgumentException e) {
                            throw new IllegalArgumentException("Unknown permission: " + p);
                        }
                    }).collect(Collectors.toSet());
        app.setRequestedPermissions(permissions);

        if (req.isSubmitForReview()) {
            app.setStatus(MiniApp.Status.PENDING_REVIEW);
            app.setSubmittedAt(LocalDateTime.now());
        } else if (app.getStatus() == null || app.getStatus() == MiniApp.Status.REJECTED) {
            app.setStatus(MiniApp.Status.DRAFT);
        }

        return toDetailResponse(miniAppRepository.save(app));
    }

    public List<MiniAppDetailResponse> getMyApps(User developer) {
        return miniAppRepository.findAllBySubmittedBy(developer.getId())
                .stream().map(this::toDetailResponse).toList();
    }

    public MiniAppDetailResponse getMyApp(String appId, User developer) {
        MiniApp app = findOwned(appId, developer);
        return toDetailResponse(app);
    }

    public MiniAppDetailResponse resubmit(String appId, User developer) {
        MiniApp app = findOwned(appId, developer);
        if (app.getStatus() != MiniApp.Status.REJECTED && app.getStatus() != MiniApp.Status.DRAFT) {
            throw new IllegalStateException("Only rejected or draft apps can be resubmitted");
        }
        app.setStatus(MiniApp.Status.PENDING_REVIEW);
        app.setSubmittedAt(LocalDateTime.now());
        app.setRejectionReason(null);
        return toDetailResponse(miniAppRepository.save(app));
    }

    private MiniApp findOwned(String appId, User developer) {
        MiniApp app = miniAppRepository.findById(appId)
                .orElseThrow(() -> new IllegalArgumentException("App not found: " + appId));
        if (!app.getSubmittedBy().equals(developer.getId())) {
            throw new IllegalStateException("You do not own this app");
        }
        return app;
    }

    // ── Admin review ───────────────────────────────────────────────────────

    public Page<MiniAppDetailResponse> getSubmissions(int page, int size) {
        return miniAppRepository.findAllByStatus(
                MiniApp.Status.PENDING_REVIEW,
                PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "submittedAt")))
                .map(this::toDetailResponse);
    }

    @Transactional
    public MiniAppDetailResponse approve(String appId, User admin) {
        MiniApp app = miniAppRepository.findById(appId)
                .orElseThrow(() -> new IllegalArgumentException("App not found: " + appId));
        if (app.getStatus() != MiniApp.Status.PENDING_REVIEW) {
            throw new IllegalStateException("App is not pending review");
        }
        app.setStatus(MiniApp.Status.ACTIVE);
        app.setReviewedBy(admin.getId());
        app.setReviewedAt(LocalDateTime.now());
        miniAppRepository.save(app);
        notifyDeveloper(app, true, null);
        log.info("Admin {} approved mini app {}", admin.getId(), appId);
        return toDetailResponse(app);
    }

    @Transactional
    public MiniAppDetailResponse reject(String appId, String reason, User admin) {
        MiniApp app = miniAppRepository.findById(appId)
                .orElseThrow(() -> new IllegalArgumentException("App not found: " + appId));
        if (app.getStatus() != MiniApp.Status.PENDING_REVIEW) {
            throw new IllegalStateException("App is not pending review");
        }
        app.setStatus(MiniApp.Status.REJECTED);
        app.setReviewedBy(admin.getId());
        app.setReviewedAt(LocalDateTime.now());
        app.setRejectionReason(reason);
        miniAppRepository.save(app);
        notifyDeveloper(app, false, reason);
        log.info("Admin {} rejected mini app {} — {}", admin.getId(), appId, reason);
        return toDetailResponse(app);
    }

    @Transactional
    public MiniAppDetailResponse suspend(String appId, String reason, User admin) {
        MiniApp app = miniAppRepository.findById(appId)
                .orElseThrow(() -> new IllegalArgumentException("App not found: " + appId));
        app.setStatus(MiniApp.Status.SUSPENDED);
        app.setReviewedBy(admin.getId());
        app.setReviewedAt(LocalDateTime.now());
        app.setRejectionReason(reason);
        miniAppRepository.save(app);
        notifyDeveloper(app, false, "Your app has been suspended: " + reason);
        log.info("Admin {} suspended mini app {}", admin.getId(), appId);
        return toDetailResponse(app);
    }

    private void notifyDeveloper(MiniApp app, boolean approved, String reason) {
        try {
            String title = approved
                    ? "\"" + app.getName() + "\" is now live!"
                    : "\"" + app.getName() + "\" was not approved";
            String body = approved
                    ? "Your mini app has been approved and is now available to all Aza users."
                    : (reason != null ? reason : "Your app did not meet our guidelines.");
            notificationService.sendNotification(
                    app.getSubmittedBy(),
                    Notification.NotificationType.SYSTEM_BROADCAST,
                    title, body,
                    Map.of("type", "MINI_APP_REVIEW", "appId", app.getId(),
                           "approved", String.valueOf(approved)));
        } catch (Exception e) {
            log.warn("Failed to notify developer of mini app review: {}", e.getMessage());
        }
    }

    // ── Consent ────────────────────────────────────────────────────────────

    public ConsentResponse getConsent(String appId, User user) {
        return consentRepository.findByUserIdAndAppId(user.getId(), appId)
                .map(c -> ConsentResponse.builder()
                        .appId(appId).granted(true)
                        .grantedPermissions(c.getGrantedPermissions().stream()
                                .map(Enum::name).collect(Collectors.toSet()))
                        .grantedAt(c.getGrantedAt())
                        .build())
                .orElse(ConsentResponse.builder().appId(appId).granted(false).build());
    }

    @Transactional
    public ConsentResponse grantConsent(String appId, Set<String> permissionNames, User user) {
        MiniApp app = miniAppRepository.findById(appId)
                .orElseThrow(() -> new IllegalArgumentException("App not found: " + appId));
        if (app.getStatus() != MiniApp.Status.ACTIVE) {
            throw new IllegalStateException("App is not active");
        }

        Set<Permission> requested = app.getRequestedPermissions();
        Set<Permission> granted = permissionNames.stream()
                .map(p -> {
                    try { return Permission.valueOf(p); }
                    catch (IllegalArgumentException e) { throw new IllegalArgumentException("Unknown permission: " + p); }
                })
                .filter(requested::contains) // only grant what the app actually requested
                .collect(Collectors.toSet());

        MiniAppConsent consent = consentRepository
                .findByUserIdAndAppId(user.getId(), appId)
                .orElseGet(() -> MiniAppConsent.builder()
                        .userId(user.getId()).appId(appId).build());
        consent.setGrantedPermissions(granted);
        consentRepository.save(consent);

        return ConsentResponse.builder()
                .appId(appId).granted(true)
                .grantedPermissions(granted.stream().map(Enum::name).collect(Collectors.toSet()))
                .grantedAt(consent.getGrantedAt())
                .build();
    }

    @Transactional
    public void revokeConsent(String appId, User user) {
        consentRepository.deleteByUserIdAndAppId(user.getId(), appId);
    }

    // ── SDK data methods (called by the native bridge, not the WebView) ────

    public SdkUserResponse getSdkUser(String appId, User user) {
        MiniAppConsent consent = requireConsent(appId, user);
        Set<Permission> granted = consent.getGrantedPermissions();

        return SdkUserResponse.builder()
                .username(user.getUsername())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .avatarUrl(user.getProfileImageUrl())
                .phone(granted.contains(Permission.USER_PHONE) ? user.getPhoneNumber() : null)
                .email(granted.contains(Permission.USER_EMAIL) ? user.getEmail() : null)
                .build();
    }

    public java.math.BigDecimal getSdkBalance(String appId, User user) {
        requirePermission(appId, user, Permission.READ_BALANCE);
        return user.getBalance();
    }

    @Transactional
    public SdkPaymentResponse requestSdkPayment(String appId, SdkPaymentRequest req, User user) {
        requirePermission(appId, user, Permission.MAKE_PAYMENTS);

        TransferRequest transfer = new TransferRequest();
        transfer.setRecipientIdentifier(req.getRecipientIdentifier());
        transfer.setAmount(req.getAmount());
        transfer.setNote(req.getNote());
        transfer.setIdempotencyKey("miniapp:" + appId + ":" + req.getIdempotencyKey());

        TransferResponse result = transferService.initiateTransfer(user, transfer);
        return SdkPaymentResponse.builder()
                .transactionId(result.getId())
                .status(result.getStatus() != null ? result.getStatus() : "PENDING")
                .amount(req.getAmount())
                .recipientUsername(req.getRecipientIdentifier())
                .note(req.getNote())
                .build();
    }

    private MiniAppConsent requireConsent(String appId, User user) {
        return consentRepository.findByUserIdAndAppId(user.getId(), appId)
                .orElseThrow(() -> new IllegalStateException(
                        "User has not granted consent for app: " + appId));
    }

    private void requirePermission(String appId, User user, Permission permission) {
        MiniAppConsent consent = requireConsent(appId, user);
        if (!consent.getGrantedPermissions().contains(permission)) {
            throw new IllegalStateException(
                    "Permission " + permission.name() + " not granted for app: " + appId);
        }
    }

    // ── Mapping helpers ────────────────────────────────────────────────────

    private MiniAppRegistryEntry toRegistryEntry(MiniApp app) {
        return MiniAppRegistryEntry.builder()
                .id(app.getId())
                .name(app.getName())
                .description(app.getDescription())
                .category(app.getCategory())
                .iconUrl(app.getIconUrl())
                .url(app.getUrl())
                .developerName(app.getDeveloperName())
                .version(app.getVersion())
                .requestedPermissions(app.getRequestedPermissions().stream()
                        .map(Enum::name).collect(Collectors.toSet()))
                .build();
    }

    private MiniAppDetailResponse toDetailResponse(MiniApp app) {
        return MiniAppDetailResponse.builder()
                .id(app.getId())
                .name(app.getName())
                .description(app.getDescription())
                .category(app.getCategory())
                .iconUrl(app.getIconUrl())
                .url(app.getUrl())
                .developerName(app.getDeveloperName())
                .supportUrl(app.getSupportUrl())
                .version(app.getVersion())
                .status(app.getStatus().name())
                .requestedPermissions(app.getRequestedPermissions().stream()
                        .map(Enum::name).collect(Collectors.toSet()))
                .createdAt(app.getCreatedAt())
                .submittedAt(app.getSubmittedAt())
                .reviewedAt(app.getReviewedAt())
                .rejectionReason(app.getRejectionReason())
                .build();
    }
}
