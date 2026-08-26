package com.aza.backend.service;

import com.aza.backend.dto.mandate.CreateMandateRequest;
import com.aza.backend.dto.mandate.MandateResponse;
import com.aza.backend.dto.miniapp.*;
import com.aza.backend.dto.transfer.TransferRequest;
import com.aza.backend.dto.transfer.TransferResponse;
import com.aza.backend.entity.MiniApp;
import com.aza.backend.entity.MiniApp.Permission;
import com.aza.backend.entity.MiniAppConsent;
import com.aza.backend.entity.Notification;
import com.aza.backend.entity.PaymentMandate;
import com.aza.backend.entity.User;
import com.aza.backend.repository.MiniAppConsentRepository;
import com.aza.backend.repository.MiniAppRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

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
    private final TransferService transferService;
    private final NotificationService notificationService;
    private final PaymentMandateService paymentMandateService;
    private final MiniAppBundleService bundleService;
    private final com.aza.backend.repository.WalletRepository walletRepository;

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
        app.setDeveloperName(req.getDeveloperName());
        app.setSupportUrl(req.getSupportUrl());
        app.setVersion(req.getVersion());

        // Hosting mode decides where `url` comes from. An AZA_HOSTED app's URL is derived from
        // its id and must never be developer-supplied, or a developer could point their catalogue
        // entry at an origin they control while passing review as "hosted by Aza".
        MiniApp.HostingMode mode = req.getHostingMode() == null || req.getHostingMode().isBlank()
                ? MiniApp.HostingMode.EXTERNAL
                : MiniApp.HostingMode.valueOf(req.getHostingMode());
        app.setHostingMode(mode);

        if (mode == MiniApp.HostingMode.AZA_HOSTED) {
            String subdomain = bundleService.deriveSubdomain(app.getId());
            app.setSubdomain(subdomain);
            app.setUrl(bundleService.publicUrl(subdomain));
        } else {
            if (req.getUrl() == null || req.getUrl().isBlank()) {
                throw new IllegalArgumentException(
                        "A URL is required for developer-hosted apps. Upload a bundle instead to let Aza host it.");
            }
            app.setSubdomain(null);
            app.setUrl(req.getUrl());
        }

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

    /**
     * Accepts a static bundle upload and stages it for review. The bundle is extracted and
     * served at the app's preview host immediately, but users keep seeing whatever is already
     * live until an admin approves it — so a developer can upload freely without risk to a
     * running app.
     */
    @Transactional
    public MiniAppDetailResponse uploadBundle(String appId, MultipartFile file, User developer) {
        MiniApp app = findOwned(appId, developer);

        if (app.getStatus() == MiniApp.Status.PENDING_REVIEW) {
            throw new IllegalStateException(
                    "This app is locked while under review. Wait for the outcome before uploading a new bundle.");
        }
        if (app.getStatus() == MiniApp.Status.SUSPENDED) {
            throw new IllegalStateException(
                    "This app is suspended. Contact support before uploading a new bundle.");
        }

        MiniAppBundleService.StoredBundle stored = bundleService.store(appId, file);

        String subdomain = bundleService.deriveSubdomain(appId);
        app.setHostingMode(MiniApp.HostingMode.AZA_HOSTED);
        app.setSubdomain(subdomain);
        app.setUrl(bundleService.publicUrl(subdomain));
        app.setPendingBundleVersion(stored.getVersion());
        app.setBundleSizeBytes(stored.getSizeBytes());
        app.setBundleUploadedAt(LocalDateTime.now());

        log.info("Developer {} uploaded bundle {} for mini app {} ({} bytes, {} files)",
                developer.getId(), stored.getVersion(), appId, stored.getSizeBytes(), stored.getFileCount());

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
        promotePendingBundle(app);
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
        // Removing it from the hub is not enough for a hosted app — anyone holding the URL could
        // still open it directly. Stop serving the bundle too. The version stays on disk, so
        // reinstating the app is a promote away.
        if (app.getHostingMode() == MiniApp.HostingMode.AZA_HOSTED) {
            bundleService.unpublish(appId);
        }
        notifyDeveloper(app, false, "Your app has been suspended: " + reason);
        log.info("Admin {} suspended mini app {}", admin.getId(), appId);
        return toDetailResponse(app);
    }

    /** Live apps with an uploaded bundle waiting on review. */
    public Page<MiniAppDetailResponse> getPendingBundleUpdates(int page, int size) {
        return miniAppRepository.findAllByStatusAndPendingBundleVersionIsNotNull(
                MiniApp.Status.ACTIVE,
                PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "bundleUploadedAt")))
                .map(this::toDetailResponse);
    }

    /**
     * Ships a new bundle for an app that is already live, without touching its review status.
     * Kept separate from {@link #approve} so that approving an update can never be confused
     * with approving a first submission.
     */
    @Transactional
    public MiniAppDetailResponse approveBundleUpdate(String appId, User admin) {
        MiniApp app = miniAppRepository.findById(appId)
                .orElseThrow(() -> new IllegalArgumentException("App not found: " + appId));
        if (app.getStatus() != MiniApp.Status.ACTIVE) {
            throw new IllegalStateException(
                    "This app is not live — review it through the submissions queue instead.");
        }
        if (app.getPendingBundleVersion() == null) {
            throw new IllegalStateException("No bundle update is pending for this app");
        }
        promotePendingBundle(app);
        app.setReviewedBy(admin.getId());
        app.setReviewedAt(LocalDateTime.now());
        miniAppRepository.save(app);

        notifyDeveloper(app, true, null);
        log.info("Admin {} approved bundle update for mini app {}", admin.getId(), appId);
        return toDetailResponse(app);
    }

    /**
     * Swaps the served bundle to the pending version, if there is one.
     *
     * <p>The filesystem swap runs before the entity is saved deliberately. A failure to promote
     * then rolls the whole transaction back, leaving the database agreeing with the disk. The
     * reverse order could commit "this version is live" for a version that never got published.
     * The remaining window — promote succeeds, commit fails — leaves the disk one version ahead
     * and is corrected by re-approving, which is idempotent.
     */
    private void promotePendingBundle(MiniApp app) {
        if (app.getHostingMode() != MiniApp.HostingMode.AZA_HOSTED) {
            return;
        }
        if (app.getPendingBundleVersion() == null) {
            if (app.getBundleVersion() == null) {
                throw new IllegalStateException(
                        "This app is set to Aza hosting but no bundle has been uploaded yet.");
            }
            return; // already live on its current bundle, nothing to swap
        }
        bundleService.promote(app.getId(), app.getPendingBundleVersion());
        app.setBundleVersion(app.getPendingBundleVersion());
        app.setPendingBundleVersion(null);
    }

    private void notifyDeveloper(MiniApp app, boolean approved, String reason) {
        try {
            String title = approved
                    ? "\"" + app.getName() + "\" is now live!"
                    : "\"" + app.getName() + "\" was not approved";
            String body = approved
                    ? "Your mini app has been approved and is now available to all Aza users."
                    : (reason != null ? reason : "Your app did not meet our guidelines.");
            Map<String, Object> data = new java.util.HashMap<>();
            data.put("type", "MINI_APP_REVIEW");
            data.put("appId", app.getId());
            data.put("approved", String.valueOf(approved));
            notificationService.sendNotification(
                    app.getSubmittedBy(),
                    Notification.NotificationType.SYSTEM_BROADCAST,
                    title, body, data);
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
        // Reads the wallet, which is the balance. This used to return a denormalised
        // copy on the user row that several credit paths never updated, so a mini-app
        // could be told a balance that was hours or days out of date.
        return walletRepository.findByUserId(user.getId())
                .map(com.aza.backend.entity.Wallet::getBalance)
                .orElse(java.math.BigDecimal.ZERO);
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

    /**
     * Creates a PENDING_APPROVAL mandate the mini-app has asked this user to authorize. Consent
     * to request one at all is gated the same way MAKE_PAYMENTS gates one-off payments; the user
     * still has to actively approve the specific mandate (ceilings, cadence) with their passcode
     * via MandateController — granting DIRECT_DEBIT permission does not itself authorize a charge.
     */
    public MandateResponse requestMandate(String appId, CreateMandateRequest request, User user) {
        requirePermission(appId, user, Permission.DIRECT_DEBIT);
        PaymentMandate mandate = paymentMandateService.create(
                user.getId(), request.getRecipientIdentifier(), request.getPerChargeLimit(),
                request.getPeriodLimit(), request.getPeriodType(), request.getExpiresAt(),
                request.getReference(), PaymentMandate.SourceType.MINI_APP, appId);
        return paymentMandateService.toResponse(mandate);
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
                .hostingMode(app.getHostingMode() != null ? app.getHostingMode().name() : null)
                .bundleVersion(app.getBundleVersion())
                .pendingBundleVersion(app.getPendingBundleVersion())
                .bundleSizeBytes(app.getBundleSizeBytes())
                .bundleUploadedAt(app.getBundleUploadedAt())
                .previewUrl(app.getPendingBundleVersion() != null && app.getSubdomain() != null
                        ? bundleService.previewUrl(app.getSubdomain())
                        : null)
                .build();
    }
}
