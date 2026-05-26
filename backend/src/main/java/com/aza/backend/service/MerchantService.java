package com.aza.backend.service;

import com.aza.backend.dto.admin.MerchantStatsResponse;
import com.aza.backend.repository.CheckoutSessionRepository;
import com.aza.backend.dto.merchant.*;
import com.aza.backend.entity.*;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.*;
import com.aza.backend.util.CloudinaryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.web.util.matcher.IpAddressMatcher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class MerchantService {

    private final MerchantRepository merchantRepository;
    private final KybRecordRepository kybRecordRepository;
    private final KybDocumentRepository kybDocumentRepository;
    private final MerchantApiKeyRepository apiKeyRepository;
    private final MerchantApiLogRepository apiLogRepository;
    private final WebhookEndpointRepository webhookRepository;
    private final MerchantPayoutRepository payoutRepository;
    private final UserService userService;
    private final WalletRepository walletRepository;
    private final UserRepository userRepository;
    private final CloudinaryService cloudinaryService;
    private final NotificationService notificationService;
    private final CheckoutSessionRepository checkoutSessionRepository;

    private static final Pattern HANDLE_PATTERN = Pattern.compile("^[a-z0-9_]{3,30}$");
    private static final long MAX_DOC_SIZE = 10 * 1024 * 1024;
    private static final List<String> ALLOWED_DOC_TYPES =
            List.of("image/jpeg", "image/png", "application/pdf");
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final int MAX_API_KEYS = 10;
    private static final int MAX_WEBHOOKS = 5;

    // ==================== MERCHANT PROFILE ====================

    public boolean isHandleAvailable(String handle) {
        return !merchantRepository.existsByBusinessHandle(handle.toLowerCase());
    }

    public MerchantResponse getMyMerchant(UUID userId) {
        Merchant merchant = merchantRepository.findByUserId(userId).orElse(null);
        if (merchant == null) return null;
        return toResponse(merchant);
    }

    @Transactional
    public MerchantResponse register(UUID userId, MerchantRegisterRequest request) {
        if (merchantRepository.findByUserId(userId).isPresent()) {
            throw new AppException("ALREADY_EXISTS", "You already have a merchant account", HttpStatus.CONFLICT);
        }

        String handle = request.getBusinessHandle().toLowerCase().trim();
        if (!HANDLE_PATTERN.matcher(handle).matches()) {
            throw new AppException("INVALID_HANDLE",
                    "Handle must be 3–30 characters: lowercase letters, numbers, and underscores only",
                    HttpStatus.BAD_REQUEST);
        }
        if (merchantRepository.existsByBusinessHandle(handle)) {
            throw new AppException("HANDLE_TAKEN", "This business handle is already taken", HttpStatus.CONFLICT);
        }

        Merchant.BusinessCategory category = null;
        if (request.getCategory() != null && !request.getCategory().isBlank()) {
            try {
                category = Merchant.BusinessCategory.valueOf(request.getCategory().toUpperCase());
            } catch (IllegalArgumentException e) {
                throw new AppException("INVALID_CATEGORY", "Invalid business category", HttpStatus.BAD_REQUEST);
            }
        }

        Merchant merchant = Merchant.builder()
                .userId(userId)
                .businessName(request.getBusinessName().trim())
                .businessHandle(handle)
                .businessEmail(request.getBusinessEmail())
                .businessPhone(request.getBusinessPhone())
                .businessDescription(request.getBusinessDescription())
                .category(category)
                .status(Merchant.MerchantStatus.PENDING_KYB)
                .build();

        merchantRepository.save(merchant);
        log.info("Merchant registered: userId={}, handle={}", userId, handle);
        return toResponse(merchant);
    }

    @Transactional
    public MerchantResponse uploadLogo(UUID userId, MultipartFile logo) {
        Merchant merchant = requireMerchant(userId);
        if (logo == null || logo.isEmpty()) {
            throw new AppException("MISSING_FILE", "Logo file is required", HttpStatus.BAD_REQUEST);
        }
        if (logo.getSize() > 5 * 1024 * 1024) {
            throw new AppException("FILE_TOO_LARGE", "Logo must be under 5 MB", HttpStatus.BAD_REQUEST);
        }
        String url = cloudinaryService.uploadProfileImage(logo);
        merchant.setLogoUrl(url);
        merchantRepository.save(merchant);
        return toResponse(merchant);
    }

    // ==================== KYB ====================

    @Transactional
    public KybStatusResponse submitKyb(UUID userId, KybSubmitRequest request) {
        Merchant merchant = requireMerchant(userId);
        if (merchant.getStatus() == Merchant.MerchantStatus.ACTIVE) {
            throw new AppException("ALREADY_ACTIVE", "Merchant is already active", HttpStatus.BAD_REQUEST);
        }

        KybRecord record = kybRecordRepository.findByMerchantId(merchant.getId())
                .orElse(KybRecord.builder().merchantId(merchant.getId()).build());

        if (record.getStatus() == KybRecord.KybStatus.UNDER_REVIEW) {
            throw new AppException("UNDER_REVIEW", "KYB is already under review", HttpStatus.BAD_REQUEST);
        }

        KybRecord.BusinessType businessType;
        try {
            businessType = KybRecord.BusinessType.valueOf(request.getBusinessType().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new AppException("INVALID_TYPE", "Invalid business type", HttpStatus.BAD_REQUEST);
        }

        KybRecord.OwnerIdType ownerIdType = null;
        if (request.getOwnerIdType() != null && !request.getOwnerIdType().isBlank()) {
            try {
                ownerIdType = KybRecord.OwnerIdType.valueOf(request.getOwnerIdType().toUpperCase());
            } catch (IllegalArgumentException e) {
                throw new AppException("INVALID_ID_TYPE", "Invalid owner ID type", HttpStatus.BAD_REQUEST);
            }
        }

        record.setRegistrationNumber(request.getRegistrationNumber());
        record.setBusinessType(businessType);
        record.setRegisteredAddress(request.getRegisteredAddress());
        record.setCity(request.getCity());
        record.setTaxIdNumber(request.getTaxIdNumber());
        record.setWebsite(request.getWebsite());
        record.setOwnerFullName(request.getOwnerFullName());
        record.setOwnerIdNumber(request.getOwnerIdNumber());
        record.setOwnerIdType(ownerIdType);
        record.setStatus(KybRecord.KybStatus.PENDING);

        kybRecordRepository.save(record);
        merchant.setStatus(Merchant.MerchantStatus.KYB_SUBMITTED);
        merchantRepository.save(merchant);

        return toKybResponse(record, merchant.getId());
    }

    @Transactional
    public KybStatusResponse submitKybFinal(UUID userId) {
        Merchant merchant = requireMerchant(userId);
        KybRecord record = kybRecordRepository.findByMerchantId(merchant.getId())
                .orElseThrow(() -> new AppException("NO_KYB", "Submit KYB info first", HttpStatus.BAD_REQUEST));

        if (record.getOwnerFullName() == null) {
            throw new AppException("INCOMPLETE", "Complete KYB info before submitting", HttpStatus.BAD_REQUEST);
        }
        if (kybDocumentRepository.findAllByMerchantId(merchant.getId()).isEmpty()) {
            throw new AppException("NO_DOCUMENTS", "Upload at least one KYB document before submitting", HttpStatus.BAD_REQUEST);
        }

        record.setStatus(KybRecord.KybStatus.UNDER_REVIEW);
        record.setSubmittedAt(LocalDateTime.now());
        kybRecordRepository.save(record);

        merchant.setStatus(Merchant.MerchantStatus.KYB_UNDER_REVIEW);
        merchantRepository.save(merchant);

        log.info("KYB submitted for review: merchantId={}", merchant.getId());
        return toKybResponse(record, merchant.getId());
    }

    @Transactional
    public KybDocumentResponse uploadKybDocument(UUID userId, MultipartFile file, String documentType) {
        Merchant merchant = requireMerchant(userId);
        KybRecord record = kybRecordRepository.findByMerchantId(merchant.getId())
                .orElseThrow(() -> new AppException("NO_KYB", "Submit KYB info first", HttpStatus.BAD_REQUEST));

        if (record.getStatus() == KybRecord.KybStatus.UNDER_REVIEW
                || record.getStatus() == KybRecord.KybStatus.APPROVED) {
            throw new AppException("LOCKED", "Cannot upload documents while under review or approved", HttpStatus.BAD_REQUEST);
        }

        if (file == null || file.isEmpty()) {
            throw new AppException("MISSING_FILE", "Document file is required", HttpStatus.BAD_REQUEST);
        }
        if (file.getSize() > MAX_DOC_SIZE) {
            throw new AppException("FILE_TOO_LARGE", "Document must be under 10 MB", HttpStatus.BAD_REQUEST);
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_DOC_TYPES.contains(contentType)) {
            throw new AppException("INVALID_TYPE", "Only JPEG, PNG, and PDF files are accepted", HttpStatus.BAD_REQUEST);
        }

        validateDocumentMagicBytes(file);

        KybDocument.DocumentType docType;
        try {
            docType = KybDocument.DocumentType.valueOf(documentType.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new AppException("INVALID_DOC_TYPE", "Invalid document type", HttpStatus.BAD_REQUEST);
        }

        String url = cloudinaryService.uploadKycDocument(file, "kyb/" + merchant.getId());

        // Strip any path separators from the original filename to prevent path traversal in stored metadata
        String rawName = file.getOriginalFilename();
        String safeFileName = rawName != null ? new java.io.File(rawName).getName() : null;

        KybDocument doc = KybDocument.builder()
                .merchantId(merchant.getId())
                .type(docType)
                .fileName(safeFileName)
                .cloudinaryUrl(url)
                .fileSizeBytes(file.getSize())
                .mimeType(contentType)
                .build();

        kybDocumentRepository.save(doc);
        return toDocResponse(doc);
    }

    public KybStatusResponse getKybStatus(UUID userId) {
        Merchant merchant = requireMerchant(userId);
        KybRecord record = kybRecordRepository.findByMerchantId(merchant.getId()).orElse(null);
        if (record == null) {
            return KybStatusResponse.builder().status("PENDING").build();
        }
        return toKybResponse(record, merchant.getId());
    }

    // ==================== API KEYS ====================

    @Transactional
    public ApiKeyResponse createApiKey(UUID userId, CreateApiKeyRequest request) {
        Merchant merchant = requireActiveMerchant(userId);

        long activeCount = apiKeyRepository.findAllByMerchantIdOrderByCreatedAtDesc(merchant.getId())
                .stream().filter(k -> Boolean.TRUE.equals(k.getIsActive())).count();
        if (activeCount >= MAX_API_KEYS) {
            throw new AppException("LIMIT_EXCEEDED",
                    "Maximum of " + MAX_API_KEYS + " active API keys allowed", HttpStatus.BAD_REQUEST);
        }

        MerchantApiKey.KeyEnvironment env = MerchantApiKey.KeyEnvironment.LIVE;
        if (request.getEnvironment() != null && !request.getEnvironment().isBlank()) {
            try {
                env = MerchantApiKey.KeyEnvironment.valueOf(request.getEnvironment().toUpperCase());
            } catch (IllegalArgumentException e) {
                throw new AppException("INVALID_ENV", "Environment must be LIVE or TEST", HttpStatus.BAD_REQUEST);
            }
        }

        MerchantApiKey.KeyType type = MerchantApiKey.KeyType.SECRET;
        if (request.getType() != null && !request.getType().isBlank()) {
            try {
                type = MerchantApiKey.KeyType.valueOf(request.getType().toUpperCase());
            } catch (IllegalArgumentException e) {
                throw new AppException("INVALID_TYPE", "Key type must be SECRET or RESTRICTED", HttpStatus.BAD_REQUEST);
            }
        }

        LocalDateTime expiresAt = null;
        if (request.getExpirationDays() != null && request.getExpirationDays() > 0) {
            expiresAt = LocalDateTime.now().plusDays(request.getExpirationDays());
        }

        String ipWhitelist = null;
        if (request.getIpWhitelist() != null && !request.getIpWhitelist().isBlank()) {
            ipWhitelist = validateAndNormalizeIpWhitelist(request.getIpWhitelist());
        }

        String scopes = null;
        if (type == MerchantApiKey.KeyType.RESTRICTED) {
            scopes = request.getScopes();
        }

        byte[] randomBytes = new byte[24];
        SECURE_RANDOM.nextBytes(randomBytes);
        String randomPart = Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);
        String prefix = env == MerchantApiKey.KeyEnvironment.LIVE ? "aza_live_" : "aza_test_";
        String fullKey = prefix + randomPart;
        String keyPrefix = fullKey.substring(0, Math.min(fullKey.length(), 20)) + "...";
        String keyHash = sha256Hex(fullKey);

        MerchantApiKey apiKey = MerchantApiKey.builder()
                .merchantId(merchant.getId())
                .label(request.getLabel())
                .keyPrefix(keyPrefix)
                .keyHash(keyHash)
                .environment(env)
                .keyType(type)
                .scopes(scopes)
                .ipWhitelist(ipWhitelist)
                .expiresAt(expiresAt)
                .build();

        apiKeyRepository.save(apiKey);
        log.info("API key created: id={}, env={}, type={}", apiKey.getId(), env, type);

        ApiKeyResponse response = toApiKeyResponse(apiKey);
        response.setFullKey(fullKey); // return the unhashed key once
        return response;
    }

    private String validateAndNormalizeIpWhitelist(String rawWhitelist) {
        String[] parts = rawWhitelist.split(",");
        List<String> clean = new java.util.ArrayList<>();
        for (String p : parts) {
            String ip = p.trim();
            if (ip.isEmpty()) continue;
            try {
                new IpAddressMatcher(ip);
                clean.add(ip);
            } catch (Exception e) {
                throw new AppException("INVALID_IP_WHITELIST", "Invalid IP or CIDR format: " + ip, HttpStatus.BAD_REQUEST);
            }
        }
        return clean.isEmpty() ? null : String.join(",", clean);
    }

    public List<ApiKeyResponse> listApiKeys(UUID userId) {
        Merchant merchant = requireMerchant(userId);
        return apiKeyRepository.findAllByMerchantIdOrderByCreatedAtDesc(merchant.getId())
                .stream().map(this::toApiKeyResponse).collect(Collectors.toList());
    }

    @Transactional
    public void revokeApiKey(UUID userId, UUID keyId) {
        Merchant merchant = requireMerchant(userId);
        MerchantApiKey key = apiKeyRepository.findById(keyId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "API key not found", HttpStatus.NOT_FOUND));
        if (!key.getMerchantId().equals(merchant.getId())) {
            throw new AppException("FORBIDDEN", "Not your API key", HttpStatus.FORBIDDEN);
        }
        if (Boolean.FALSE.equals(key.getIsActive())) {
            apiKeyRepository.delete(key);
            log.info("API key deleted for merchantId={}", merchant.getId());
        } else {
            key.setIsActive(false);
            key.setRevokedAt(LocalDateTime.now());
            apiKeyRepository.save(key);
            log.info("API key revoked for merchantId={}", merchant.getId());
        }
    }

    public MerchantApiKey validateApiKey(String keyHash, String ipAddress, String userAgent) {
        MerchantApiKey apiKey = apiKeyRepository.findByKeyHashAndIsActiveTrue(keyHash).orElse(null);
        boolean isOldKey = false;
        if (apiKey == null) {
            apiKey = apiKeyRepository.findByOldKeyHashAndIsActiveTrue(keyHash).orElse(null);
            isOldKey = apiKey != null;
        }

        if (apiKey == null) return null;

        if (apiKey.getExpiresAt() != null && LocalDateTime.now().isAfter(apiKey.getExpiresAt())) {
            return null;
        }

        if (isOldKey) {
            if (apiKey.getOldKeyExpiresAt() == null || LocalDateTime.now().isAfter(apiKey.getOldKeyExpiresAt())) {
                return null;
            }
        }

        if (apiKey.getIpWhitelist() != null && !apiKey.getIpWhitelist().isBlank()) {
            boolean ipAllowed = false;
            for (String allowed : apiKey.getIpWhitelist().split(",")) {
                try {
                    IpAddressMatcher matcher = new IpAddressMatcher(allowed.trim());
                    if (matcher.matches(ipAddress)) {
                        ipAllowed = true;
                        break;
                    }
                } catch (Exception e) {
                    // ignore
                }
            }
            if (!ipAllowed) {
                throw new AppException("UNAUTHORIZED_IP", "IP address " + ipAddress + " is not whitelisted for this API key", HttpStatus.UNAUTHORIZED);
            }
        }

        apiKey.setLastUsedAt(LocalDateTime.now());
        apiKey.setLastUsedIp(ipAddress);
        apiKey.setLastUsedUserAgent(userAgent);
        apiKeyRepository.save(apiKey);

        return apiKey;
    }

    public Merchant getMerchantForApiKey(MerchantApiKey apiKey) {
        return merchantRepository.findById(apiKey.getMerchantId()).orElse(null);
    }

    @Transactional
    public ApiKeyResponse updateApiKey(UUID userId, UUID keyId, UpdateApiKeyRequest request) {
        Merchant merchant = requireMerchant(userId);
        MerchantApiKey key = apiKeyRepository.findById(keyId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "API key not found", HttpStatus.NOT_FOUND));
        if (!key.getMerchantId().equals(merchant.getId())) {
            throw new AppException("FORBIDDEN", "Not your API key", HttpStatus.FORBIDDEN);
        }

        if (request.getLabel() != null) {
            key.setLabel(request.getLabel().trim());
        }
        if (request.getIpWhitelist() != null) {
            if (request.getIpWhitelist().isBlank()) {
                key.setIpWhitelist(null);
            } else {
                key.setIpWhitelist(validateAndNormalizeIpWhitelist(request.getIpWhitelist()));
            }
        }
        if (request.getScopes() != null) {
            if (key.getKeyType() == MerchantApiKey.KeyType.RESTRICTED) {
                key.setScopes(request.getScopes().trim());
            }
        }

        apiKeyRepository.save(key);
        log.info("API key updated: id={}, label={}", key.getId(), key.getLabel());
        return toApiKeyResponse(key);
    }

    @Transactional
    public ApiKeyResponse rollApiKey(UUID userId, UUID keyId, RollApiKeyRequest request) {
        Merchant merchant = requireMerchant(userId);
        MerchantApiKey apiKey = apiKeyRepository.findById(keyId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "API key not found", HttpStatus.NOT_FOUND));
        if (!apiKey.getMerchantId().equals(merchant.getId())) {
            throw new AppException("FORBIDDEN", "Not your API key", HttpStatus.FORBIDDEN);
        }
        if (Boolean.FALSE.equals(apiKey.getIsActive())) {
            throw new AppException("BAD_REQUEST", "Cannot roll a revoked API key", HttpStatus.BAD_REQUEST);
        }

        int graceHours = (request != null && request.getExpirationHours() != null) ? request.getExpirationHours() : 24;
        if (graceHours < 0 || graceHours > 720) {
            throw new AppException("BAD_REQUEST", "Grace period must be between 0 and 720 hours", HttpStatus.BAD_REQUEST);
        }

        apiKey.setOldKeyHash(apiKey.getKeyHash());
        apiKey.setOldKeyExpiresAt(LocalDateTime.now().plusHours(graceHours));

        byte[] randomBytes = new byte[24];
        SECURE_RANDOM.nextBytes(randomBytes);
        String randomPart = Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);
        String prefix = apiKey.getEnvironment() == MerchantApiKey.KeyEnvironment.LIVE ? "aza_live_" : "aza_test_";
        String fullKey = prefix + randomPart;
        String keyPrefix = fullKey.substring(0, Math.min(fullKey.length(), 20)) + "...";
        String keyHash = sha256Hex(fullKey);

        apiKey.setKeyPrefix(keyPrefix);
        apiKey.setKeyHash(keyHash);

        apiKeyRepository.save(apiKey);
        log.info("API key rolled: id={}, environment={}", apiKey.getId(), apiKey.getEnvironment());

        ApiKeyResponse response = toApiKeyResponse(apiKey);
        response.setFullKey(fullKey);
        return response;
    }

    public Page<MerchantApiLog> listApiLogs(UUID userId, int page, int size) {
        Merchant merchant = requireMerchant(userId);
        return apiLogRepository.findAllByMerchantIdOrderByCreatedAtDesc(
                merchant.getId(), PageRequest.of(page, Math.min(size, 100)));
    }

    @Transactional
    public void logApiRequest(UUID merchantId, UUID apiKeyId, String method, String path,
                               Integer statusCode, String ipAddress, String userAgent, String errorMessage) {
        try {
            MerchantApiLog logEntry = MerchantApiLog.builder()
                    .merchantId(merchantId)
                    .apiKeyId(apiKeyId)
                    .method(method)
                    .path(path)
                    .statusCode(statusCode)
                    .ipAddress(ipAddress)
                    .userAgent(userAgent)
                    .errorMessage(errorMessage)
                    .build();
            apiLogRepository.save(logEntry);
        } catch (Exception e) {
            log.error("Failed to save API log: ", e);
        }
    }

    // ==================== WEBHOOKS ====================

    @Transactional
    public WebhookEndpointResponse createWebhook(UUID userId, WebhookEndpointRequest request) {
        Merchant merchant = requireActiveMerchant(userId);

        validateWebhookUrl(request.getUrl());

        long activeCount = webhookRepository.findAllByMerchantIdAndIsActiveTrue(merchant.getId()).size();
        if (activeCount >= MAX_WEBHOOKS) {
            throw new AppException("LIMIT_EXCEEDED",
                    "Maximum of " + MAX_WEBHOOKS + " active webhook endpoints allowed", HttpStatus.BAD_REQUEST);
        }

        byte[] secretBytes = new byte[32];
        SECURE_RANDOM.nextBytes(secretBytes);
        String signingSecret = "whsec_" + HexFormat.of().formatHex(secretBytes);

        WebhookEndpoint endpoint = WebhookEndpoint.builder()
                .merchantId(merchant.getId())
                .url(request.getUrl())
                .signingSecret(signingSecret)
                .events(request.getEvents() != null ? request.getEvents() : "checkout.completed")
                .build();

        webhookRepository.save(endpoint);

        return WebhookEndpointResponse.builder()
                .id(endpoint.getId().toString())
                .url(endpoint.getUrl())
                .signingSecret(signingSecret) // only shown once
                .isActive(true)
                .events(endpoint.getEvents())
                .createdAt(endpoint.getCreatedAt())
                .build();
    }

    public List<WebhookEndpointResponse> listWebhooks(UUID userId) {
        Merchant merchant = requireMerchant(userId);
        return webhookRepository.findAllByMerchantId(merchant.getId())
                .stream().map(e -> WebhookEndpointResponse.builder()
                        .id(e.getId().toString())
                        .url(e.getUrl())
                        .isActive(e.getIsActive())
                        .events(e.getEvents())
                        .createdAt(e.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
    }

    @Transactional
    public void deleteWebhook(UUID userId, UUID endpointId) {
        Merchant merchant = requireMerchant(userId);
        WebhookEndpoint endpoint = webhookRepository.findById(endpointId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Webhook not found", HttpStatus.NOT_FOUND));
        if (!endpoint.getMerchantId().equals(merchant.getId())) {
            throw new AppException("FORBIDDEN", "Not your webhook", HttpStatus.FORBIDDEN);
        }
        endpoint.setIsActive(false);
        webhookRepository.save(endpoint);
    }

    // ==================== PAYOUTS ====================

    @Transactional
    public PayoutResponse requestPayout(UUID userId, PayoutRequest request) {
        // Verify passcode BEFORE acquiring any locks — avoids holding locks during the Redis round-trip
        com.aza.backend.entity.User owner = userService.findById(userId);
        userService.verifyPasscode(owner, request.getPasscode());

        // Pessimistic lock prevents concurrent payouts from double-spending the same balance
        Merchant merchant = merchantRepository.findByUserIdForUpdate(userId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "No merchant account found", HttpStatus.NOT_FOUND));
        if (merchant.getStatus() != Merchant.MerchantStatus.ACTIVE) {
            throw new AppException("NOT_ACTIVE",
                    "Your merchant account must be active to perform this action", HttpStatus.FORBIDDEN);
        }

        if (request.getAmount().compareTo(merchant.getBalance()) > 0) {
            throw new AppException("INSUFFICIENT_FUNDS",
                    "Payout amount exceeds your merchant balance of "
                            + merchant.getCurrency() + " " + merchant.getBalance(),
                    HttpStatus.BAD_REQUEST);
        }

        // Debit merchant balance, credit personal wallet
        merchant.setBalance(merchant.getBalance().subtract(request.getAmount()));
        merchantRepository.save(merchant);

        Wallet wallet = walletRepository.findByUserId(userId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Personal wallet not found", HttpStatus.NOT_FOUND));
        wallet.setBalance(wallet.getBalance().add(request.getAmount()));
        walletRepository.save(wallet);
        owner.setBalance(wallet.getBalance());
        userRepository.save(owner);

        MerchantPayout payout = MerchantPayout.builder()
                .merchantId(merchant.getId())
                .amount(request.getAmount())
                .status(MerchantPayout.PayoutStatus.COMPLETED)
                .note(request.getNote())
                .completedAt(LocalDateTime.now())
                .build();

        payoutRepository.save(payout);
        log.info("Payout completed: merchantId={}, amount={}", merchant.getId(), request.getAmount());

        return PayoutResponse.builder()
                .id(payout.getId().toString())
                .amount(payout.getAmount())
                .currency(merchant.getCurrency())
                .status(payout.getStatus().name())
                .note(payout.getNote())
                .requestedAt(payout.getRequestedAt())
                .completedAt(payout.getCompletedAt())
                .build();
    }

    public Page<PayoutResponse> listPayouts(UUID userId, int page, int size) {
        Merchant merchant = requireMerchant(userId);
        return payoutRepository.findAllByMerchantIdOrderByRequestedAtDesc(
                        merchant.getId(), PageRequest.of(page, Math.min(size, 50)))
                .map(p -> PayoutResponse.builder()
                        .id(p.getId().toString())
                        .amount(p.getAmount())
                        .currency(p.getCurrency())
                        .status(p.getStatus().name())
                        .note(p.getNote())
                        .requestedAt(p.getRequestedAt())
                        .completedAt(p.getCompletedAt())
                        .build());
    }

    // ==================== UPDATE PROFILE ====================

    @Transactional
    public MerchantResponse updateMerchant(UUID userId, UpdateMerchantRequest request) {
        Merchant merchant = requireMerchant(userId);
        if (request.getBusinessName() != null && !request.getBusinessName().isBlank()) {
            merchant.setBusinessName(request.getBusinessName().trim());
        }
        if (request.getBusinessEmail() != null) {
            merchant.setBusinessEmail(request.getBusinessEmail());
        }
        if (request.getBusinessPhone() != null) {
            merchant.setBusinessPhone(request.getBusinessPhone());
        }
        if (request.getBusinessDescription() != null) {
            merchant.setBusinessDescription(request.getBusinessDescription());
        }
        if (request.getLogoUrl() != null) {
            merchant.setLogoUrl(request.getLogoUrl());
        }
        merchantRepository.save(merchant);
        return toResponse(merchant);
    }

    // ==================== BALANCE ====================

    public BalanceResponse getBalance(UUID userId) {
        Merchant merchant = requireMerchant(userId);
        return BalanceResponse.builder()
                .balance(merchant.getBalance())
                .currency(merchant.getCurrency())
                .totalVolume(merchant.getTotalVolume())
                .build();
    }

    // ==================== REPORTS ====================

    public ReportSummaryResponse getReportSummary(UUID userId) {
        Merchant merchant = requireMerchant(userId);
        UUID merchantId = merchant.getId();
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime startOfToday = now.toLocalDate().atStartOfDay();
        LocalDateTime sevenDaysAgo = now.minusDays(7);
        LocalDateTime thirtyDaysAgo = now.minusDays(30);
        LocalDateTime epoch = LocalDateTime.of(2000, 1, 1, 0, 0);

        BigDecimal todayRevenue = checkoutSessionRepository.sumNetAmountSince(merchantId, startOfToday);
        BigDecimal sevenDayRevenue = checkoutSessionRepository.sumNetAmountSince(merchantId, sevenDaysAgo);
        BigDecimal thirtyDayRevenue = checkoutSessionRepository.sumNetAmountSince(merchantId, thirtyDaysAgo);
        BigDecimal allTimeRevenue = checkoutSessionRepository.sumNetAmountSince(merchantId, epoch);

        long todayPayments = checkoutSessionRepository.countCompletedSince(merchantId, startOfToday);
        long sevenDayPayments = checkoutSessionRepository.countCompletedSince(merchantId, sevenDaysAgo);
        long thirtyDayPayments = checkoutSessionRepository.countCompletedSince(merchantId, thirtyDaysAgo);
        long allTimeCompleted = checkoutSessionRepository.countCompletedSince(merchantId, epoch);
        long allTimeTotal = checkoutSessionRepository.countTotalSince(merchantId, epoch);

        double successRate = allTimeTotal > 0 ? (double) allTimeCompleted / allTimeTotal * 100.0 : 0.0;

        List<Object[]> dailyRaw = checkoutSessionRepository.getDailyRevenueSince(merchantId, thirtyDaysAgo);
        List<ReportSummaryResponse.DayPoint> dailySeries = dailyRaw.stream()
                .map(row -> ReportSummaryResponse.DayPoint.builder()
                        .date(row[0].toString())
                        .revenue(row[1] instanceof BigDecimal ? (BigDecimal) row[1]
                                : new BigDecimal(row[1].toString()))
                        .count(((Number) row[2]).longValue())
                        .build())
                .collect(Collectors.toList());

        return ReportSummaryResponse.builder()
                .todayRevenue(todayRevenue)
                .sevenDayRevenue(sevenDayRevenue)
                .thirtyDayRevenue(thirtyDayRevenue)
                .allTimeRevenue(allTimeRevenue)
                .todayPayments(todayPayments)
                .sevenDayPayments(sevenDayPayments)
                .thirtyDayPayments(thirtyDayPayments)
                .allTimePayments(allTimeCompleted)
                .successRate(successRate)
                .dailySeries(dailySeries)
                .build();
    }

    // ==================== UPDATE WEBHOOK ====================

    @Transactional
    public WebhookEndpointResponse updateWebhookEndpoint(UUID userId, UUID endpointId, WebhookEndpointRequest request) {
        Merchant merchant = requireMerchant(userId);
        WebhookEndpoint endpoint = webhookRepository.findById(endpointId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Webhook not found", HttpStatus.NOT_FOUND));
        if (!endpoint.getMerchantId().equals(merchant.getId())) {
            throw new AppException("FORBIDDEN", "Not your webhook", HttpStatus.FORBIDDEN);
        }
        if (request.getUrl() != null && !request.getUrl().isBlank()) {
            validateWebhookUrl(request.getUrl());
            endpoint.setUrl(request.getUrl());
        }
        if (request.getEvents() != null) {
            endpoint.setEvents(request.getEvents());
        }
        if (request.getIsActive() != null) {
            endpoint.setIsActive(request.getIsActive());
        }
        webhookRepository.save(endpoint);
        return WebhookEndpointResponse.builder()
                .id(endpoint.getId().toString())
                .url(endpoint.getUrl())
                .isActive(endpoint.getIsActive())
                .events(endpoint.getEvents())
                .createdAt(endpoint.getCreatedAt())
                .build();
    }

    // ==================== ADMIN ====================

    public MerchantResponse adminGetById(UUID merchantId) {
        Merchant merchant = merchantRepository.findById(merchantId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Merchant not found", HttpStatus.NOT_FOUND));
        return toAdminResponse(merchant);
    }

    public KybStatusResponse getKybStatusForAdmin(UUID merchantId) {
        merchantRepository.findById(merchantId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Merchant not found", HttpStatus.NOT_FOUND));
        KybRecord record = kybRecordRepository.findByMerchantId(merchantId).orElse(null);
        if (record == null) return KybStatusResponse.builder().status("PENDING").build();
        return toKybResponse(record, merchantId);
    }

    public Page<MerchantResponse> adminSearch(String query, String status, int page, int size) {
        String statusValue = null;
        if (status != null && !status.isBlank()) {
            try {
                statusValue = Merchant.MerchantStatus.valueOf(status.toUpperCase()).name();
            } catch (IllegalArgumentException e) {
                throw new AppException("INVALID_STATUS", "Invalid merchant status", HttpStatus.BAD_REQUEST);
            }
        }
        return merchantRepository.search(
                        query == null || query.isBlank() ? null : query,
                        statusValue,
                        PageRequest.of(page, Math.min(size, 50)))
                .map(this::toAdminResponse);
    }

    @Transactional
    public KybStatusResponse adminReviewKyb(UUID merchantId, boolean approve,
                                            String rejectionReason, String moreInfoRequest) {
        Merchant merchant = merchantRepository.findById(merchantId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Merchant not found", HttpStatus.NOT_FOUND));

        KybRecord record = kybRecordRepository.findByMerchantId(merchantId)
                .orElseThrow(() -> new AppException("NO_KYB", "No KYB record found", HttpStatus.NOT_FOUND));

        if (record.getStatus() == KybRecord.KybStatus.APPROVED) {
            throw new AppException("ALREADY_APPROVED", "KYB is already approved", HttpStatus.BAD_REQUEST);
        }

        record.setReviewedAt(LocalDateTime.now());
        if (record.getSubmittedAt() == null) {
            record.setSubmittedAt(LocalDateTime.now());
        }

        if (approve) {
            record.setStatus(KybRecord.KybStatus.APPROVED);
            merchant.setStatus(Merchant.MerchantStatus.ACTIVE);
            merchant.setActivatedAt(LocalDateTime.now());
            log.info("KYB approved for merchantId={}", merchantId);
        } else if (moreInfoRequest != null && !moreInfoRequest.isBlank()) {
            record.setStatus(KybRecord.KybStatus.MORE_INFO_REQUIRED);
            record.setMoreInfoRequest(moreInfoRequest);
            // Allow re-submission
            record.setSubmittedAt(null);
            merchant.setStatus(Merchant.MerchantStatus.MORE_INFO_REQUIRED);
            merchant.setMoreInfoRequest(moreInfoRequest);
            log.info("KYB more info requested for merchantId={}", merchantId);
        } else {
            record.setStatus(KybRecord.KybStatus.REJECTED);
            record.setRejectionReason(rejectionReason);
            merchant.setStatus(Merchant.MerchantStatus.REJECTED);
            merchant.setRejectionReason(rejectionReason);
            log.info("KYB rejected for merchantId={}", merchantId);
        }

        kybRecordRepository.save(record);
        merchantRepository.save(merchant);

        // Push notification to the merchant owner
        UUID ownerId = merchant.getUserId();
        if (approve) {
            notificationService.sendNotification(
                    ownerId,
                    Notification.NotificationType.KYB_APPROVED,
                    "Business Verified 🎉",
                    "Your business has been verified! You can now accept payments.",
                    java.util.Map.of("type", "KYB_APPROVED", "merchantId", merchantId.toString()));
        } else if (moreInfoRequest != null && !moreInfoRequest.isBlank()) {
            notificationService.sendNotification(
                    ownerId,
                    Notification.NotificationType.KYB_MORE_INFO_REQUIRED,
                    "Action Required: Business Verification",
                    moreInfoRequest,
                    java.util.Map.of("type", "KYB_MORE_INFO_REQUIRED", "merchantId", merchantId.toString()));
        } else {
            notificationService.sendNotification(
                    ownerId,
                    Notification.NotificationType.KYB_REJECTED,
                    "Business Verification Update",
                    rejectionReason != null ? rejectionReason : "Your business verification was not successful. Please contact support.",
                    java.util.Map.of("type", "KYB_REJECTED", "merchantId", merchantId.toString()));
        }

        return toKybResponse(record, merchantId);
    }

    @Transactional
    public MerchantResponse adminSetStatus(UUID merchantId, String status) {
        Merchant merchant = merchantRepository.findById(merchantId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Merchant not found", HttpStatus.NOT_FOUND));
        try {
            merchant.setStatus(Merchant.MerchantStatus.valueOf(status.toUpperCase()));
        } catch (IllegalArgumentException e) {
            throw new AppException("INVALID_STATUS", "Invalid status", HttpStatus.BAD_REQUEST);
        }
        merchantRepository.save(merchant);
        return toResponse(merchant);
    }

    @Transactional
    public MerchantResponse adminSetFeeRate(UUID merchantId, int feeRateBps) {
        if (feeRateBps < 0 || feeRateBps > 10000) {
            throw new AppException("INVALID_FEE_RATE", "Fee rate must be between 0 and 10000 bps (0–100%)", HttpStatus.BAD_REQUEST);
        }
        Merchant merchant = merchantRepository.findById(merchantId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Merchant not found", HttpStatus.NOT_FOUND));
        merchant.setFeeRateBps(feeRateBps);
        merchantRepository.save(merchant);
        log.info("Fee rate updated for merchantId={}, feeRateBps={}", merchantId, feeRateBps);
        return toResponse(merchant);
    }

    public Page<MerchantResponse> adminGetKybQueue(int page, int size) {
        List<Merchant.MerchantStatus> statuses = List.of(
                Merchant.MerchantStatus.KYB_SUBMITTED,
                Merchant.MerchantStatus.KYB_UNDER_REVIEW,
                Merchant.MerchantStatus.MORE_INFO_REQUIRED
        );
        return merchantRepository.findByStatusIn(statuses, PageRequest.of(page, Math.min(size, 50)))
                .map(this::toAdminResponse);
    }

    public MerchantStatsResponse adminGetStats() {
        BigDecimal totalBalance = merchantRepository.sumTotalMerchantBalance();
        BigDecimal totalVolume = merchantRepository.sumActiveMerchantVolume();
        return MerchantStatsResponse.builder()
                .total(merchantRepository.count())
                .active(merchantRepository.countByStatus(Merchant.MerchantStatus.ACTIVE))
                .pendingKyb(merchantRepository.countByStatus(Merchant.MerchantStatus.PENDING_KYB))
                .kybSubmitted(merchantRepository.countByStatus(Merchant.MerchantStatus.KYB_SUBMITTED))
                .kybUnderReview(merchantRepository.countByStatus(Merchant.MerchantStatus.KYB_UNDER_REVIEW))
                .moreInfoRequired(merchantRepository.countByStatus(Merchant.MerchantStatus.MORE_INFO_REQUIRED))
                .suspended(merchantRepository.countByStatus(Merchant.MerchantStatus.SUSPENDED))
                .rejected(merchantRepository.countByStatus(Merchant.MerchantStatus.REJECTED))
                .totalBalance(totalBalance != null ? totalBalance : BigDecimal.ZERO)
                .totalVolume(totalVolume != null ? totalVolume : BigDecimal.ZERO)
                .build();
    }

    public Page<PayoutResponse> adminGetPayouts(UUID merchantId, int page, int size) {
        merchantRepository.findById(merchantId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Merchant not found", HttpStatus.NOT_FOUND));
        return payoutRepository.findAllByMerchantIdOrderByRequestedAtDesc(
                        merchantId, PageRequest.of(page, Math.min(size, 50)))
                .map(p -> PayoutResponse.builder()
                        .id(p.getId().toString())
                        .amount(p.getAmount())
                        .currency(p.getCurrency())
                        .status(p.getStatus().name())
                        .note(p.getNote())
                        .requestedAt(p.getRequestedAt())
                        .completedAt(p.getCompletedAt())
                        .build());
    }

    // ==================== INTERNAL HELPERS ====================

    private static void validateWebhookUrl(String rawUrl) {
        if (rawUrl == null || rawUrl.isBlank()) {
            throw new AppException("INVALID_URL", "Webhook URL is required", HttpStatus.BAD_REQUEST);
        }
        java.net.URL parsed;
        try {
            parsed = java.net.URI.create(rawUrl).toURL();
        } catch (Exception e) {
            throw new AppException("INVALID_URL", "Invalid webhook URL format", HttpStatus.BAD_REQUEST);
        }
        if (!"https".equalsIgnoreCase(parsed.getProtocol())) {
            throw new AppException("INVALID_URL", "Webhook URL must use HTTPS", HttpStatus.BAD_REQUEST);
        }
        String host = parsed.getHost().toLowerCase();
        if (host.isEmpty()) {
            throw new AppException("INVALID_URL", "Webhook URL must have a valid host", HttpStatus.BAD_REQUEST);
        }
        // Block literal private/loopback IP addresses
        try {
            java.net.InetAddress addr = java.net.InetAddress.getByName(host);
            if (addr.isLoopbackAddress() || addr.isSiteLocalAddress()
                    || addr.isLinkLocalAddress() || addr.isAnyLocalAddress()
                    || addr.isMulticastAddress()) {
                throw new AppException("INVALID_URL",
                        "Webhook URL cannot target internal or reserved network addresses", HttpStatus.BAD_REQUEST);
            }
        } catch (Exception e) {
            if (e instanceof AppException) throw (AppException) e;
            // DNS resolution failed — reject; don't deliver to unresolvable hosts
            throw new AppException("INVALID_URL",
                    "Webhook URL host could not be resolved", HttpStatus.BAD_REQUEST);
        }
    }

    private static void validateDocumentMagicBytes(MultipartFile file) {
        try {
            byte[] bytes = file.getBytes();
            if (bytes.length < 4) {
                throw new AppException("INVALID_FILE", "File is too small or corrupt", HttpStatus.BAD_REQUEST);
            }
            boolean isJpeg = (bytes[0] & 0xFF) == 0xFF && (bytes[1] & 0xFF) == 0xD8 && (bytes[2] & 0xFF) == 0xFF;
            boolean isPng  = (bytes[0] & 0xFF) == 0x89 && (bytes[1] & 0xFF) == 0x50
                    && (bytes[2] & 0xFF) == 0x4E && (bytes[3] & 0xFF) == 0x47;
            boolean isPdf  = (bytes[0] & 0xFF) == 0x25 && (bytes[1] & 0xFF) == 0x50
                    && (bytes[2] & 0xFF) == 0x44 && (bytes[3] & 0xFF) == 0x46;
            if (!isJpeg && !isPng && !isPdf) {
                throw new AppException("INVALID_FILE",
                        "File content does not match its declared type", HttpStatus.BAD_REQUEST);
            }
        } catch (java.io.IOException e) {
            throw new AppException("INVALID_FILE", "Could not read file content", HttpStatus.BAD_REQUEST);
        }
    }



    public static String sha256Hex(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    private Merchant requireMerchant(UUID userId) {
        return merchantRepository.findByUserId(userId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "No merchant account found", HttpStatus.NOT_FOUND));
    }

    private Merchant requireActiveMerchant(UUID userId) {
        Merchant m = requireMerchant(userId);
        if (m.getStatus() != Merchant.MerchantStatus.ACTIVE) {
            throw new AppException("NOT_ACTIVE",
                    "Your merchant account must be active to perform this action", HttpStatus.FORBIDDEN);
        }
        return m;
    }

    private MerchantResponse toResponse(Merchant m) {
        return toResponseBuilder(m).build();
    }

    private MerchantResponse toAdminResponse(Merchant m) {
        int activeKeys = (int) apiKeyRepository.findAllByMerchantIdOrderByCreatedAtDesc(m.getId())
                .stream().filter(k -> Boolean.TRUE.equals(k.getIsActive())).count();
        int activeWebhooks = webhookRepository.findAllByMerchantIdAndIsActiveTrue(m.getId()).size();
        return toResponseBuilder(m)
                .activeApiKeyCount(activeKeys)
                .activeWebhookCount(activeWebhooks)
                .build();
    }

    private MerchantResponse.MerchantResponseBuilder toResponseBuilder(Merchant m) {
        return MerchantResponse.builder()
                .id(m.getId().toString())
                .userId(m.getUserId().toString())
                .businessName(m.getBusinessName())
                .businessHandle(m.getBusinessHandle())
                .businessEmail(m.getBusinessEmail())
                .businessPhone(m.getBusinessPhone())
                .businessDescription(m.getBusinessDescription())
                .logoUrl(m.getLogoUrl())
                .category(m.getCategory() != null ? m.getCategory().name() : null)
                .status(m.getStatus().name())
                .rejectionReason(m.getRejectionReason())
                .moreInfoRequest(m.getMoreInfoRequest())
                .balance(m.getBalance())
                .currency(m.getCurrency())
                .totalVolume(m.getTotalVolume())
                .feeRateBps(m.getFeeRateBps())
                .createdAt(m.getCreatedAt())
                .activatedAt(m.getActivatedAt());
    }

    private KybStatusResponse toKybResponse(KybRecord record, UUID merchantId) {
        List<KybDocument> docs = kybDocumentRepository.findAllByMerchantId(merchantId);
        return KybStatusResponse.builder()
                .status(record.getStatus().name())
                .registrationNumber(record.getRegistrationNumber())
                .businessType(record.getBusinessType() != null ? record.getBusinessType().name() : null)
                .registeredAddress(record.getRegisteredAddress())
                .city(record.getCity())
                .taxIdNumber(record.getTaxIdNumber())
                .website(record.getWebsite())
                .ownerFullName(record.getOwnerFullName())
                .ownerIdType(record.getOwnerIdType() != null ? record.getOwnerIdType().name() : null)
                .rejectionReason(record.getRejectionReason())
                .moreInfoRequest(record.getMoreInfoRequest())
                .documents(docs.stream().map(this::toDocResponse).collect(Collectors.toList()))
                .submittedAt(record.getSubmittedAt())
                .reviewedAt(record.getReviewedAt())
                .build();
    }

    private KybDocumentResponse toDocResponse(KybDocument doc) {
        return KybDocumentResponse.builder()
                .id(doc.getId().toString())
                .type(doc.getType().name())
                .fileName(doc.getFileName())
                .url(doc.getCloudinaryUrl())
                .fileSizeBytes(doc.getFileSizeBytes())
                .mimeType(doc.getMimeType())
                .uploadedAt(doc.getUploadedAt())
                .build();
    }

    private ApiKeyResponse toApiKeyResponse(MerchantApiKey key) {
        return ApiKeyResponse.builder()
                .id(key.getId().toString())
                .label(key.getLabel())
                .keyPrefix(key.getKeyPrefix())
                .environment(key.getEnvironment().name())
                .keyType(key.getKeyType() != null ? key.getKeyType().name() : null)
                .scopes(key.getScopes())
                .ipWhitelist(key.getIpWhitelist())
                .expiresAt(key.getExpiresAt())
                .lastUsedIp(key.getLastUsedIp())
                .lastUsedUserAgent(key.getLastUsedUserAgent())
                .isActive(key.getIsActive())
                .lastUsedAt(key.getLastUsedAt())
                .createdAt(key.getCreatedAt())
                .revokedAt(key.getRevokedAt())
                .build();
    }
}
