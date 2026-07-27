package com.aza.backend.service;

import com.aza.backend.dto.auth.AuthResponse;
import com.aza.backend.dto.user.*;
import com.aza.backend.dto.user.SilentHoursRequest;
import com.aza.backend.entity.RefreshToken;
import com.aza.backend.entity.User;
import com.aza.backend.entity.Merchant;
import com.aza.backend.repository.RefreshTokenRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.repository.MerchantRepository;
import com.aza.backend.security.JwtUtil;
import com.aza.backend.util.CloudinaryService;
import com.aza.backend.util.EmailService;
import com.aza.backend.util.SmsService;
import com.aza.backend.exception.AppException;
import org.springframework.http.HttpStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.LocalDate;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final MerchantRepository merchantRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final CloudinaryService cloudinaryService;
    private final StringRedisTemplate redisTemplate;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final OtpService otpService;
    private final NotificationService notificationService;
    private final ImageService imageService;
    private final EmailService emailService;
    private final SmsService smsService;
    private final PresenceService presenceService;
    private final StaffRoleService staffRoleService;

    private static final String BLACKLIST_PREFIX = "jwt:blacklist:";

    private static final long MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    private static final List<String> ALLOWED_CONTENT_TYPES = List.of("image/jpeg", "image/png");
    private static final Pattern HANDLE_PATTERN = Pattern.compile("^[a-z0-9_]{3,30}$");
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[A-Za-z0-9+_.-]+@(.+)$");
    private static final Pattern PHONE_PATTERN = Pattern.compile("^\\+?[0-9]{7,15}$");

    // ==================== PROFILE ====================

    public AuthResponse.UserInfo getProfile(User user) {
        return AuthResponse.UserInfo.builder()
                .id(user.getId().toString())
                .email(user.getEmail())
                .phone(user.getPhoneNumber())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .handle(user.getUsername())
                .pronouns(user.getPronouns())
                .dateOfBirth(user.getDateOfBirth() != null ? user.getDateOfBirth().toString() : null)
                .profileImageUrl(user.getProfileImageUrl())
                .kycStatus(user.getKycStatus().name())
                .role(user.getRole() != null ? user.getRole().name() : "USER")
                .staffRoles(staffRoleService.getActiveRoles(user).stream().map(Enum::name).sorted().toList())
                .passcodeSet(user.getPasscodeHash() != null)
                .homeAddress(user.getHomeAddress())
                .city(user.getCity())
                .nationality(user.getNationality())
                .otherNationality(user.getOtherNationality())
                .isTaxResidentAbroad(user.getIsTaxResidentAbroad())
                .taxCountry(user.getTaxCountry())
                .isUSPerson(user.getIsUSPerson())
                .findMeByPhone(user.getFindMeByPhone())
                .findMeByEmail(user.getFindMeByEmail())
                .findMeByHandle(user.getFindMeByHandle())
                .syncContacts(user.getSyncContacts())
                .showOnlineStatus(user.getShowOnlineStatus())
                .billForwardingEnabled(user.getBillForwardingEnabled())
                .twoFactorEnabled(user.getTwoFactorEnabled())
                .totpEnabled(user.getTwoFactorSecret() != null)
                .smsTwoFactorEnabled(user.getSmsTwoFactorEnabled())
                .emailTwoFactorEnabled(user.getEmailTwoFactorEnabled())
                .appTwoFactorEnabled(user.getAppTwoFactorEnabled())
                .passkeysEnabled(user.getPasskeysEnabled())
                .defaultTwoFactorMethod(user.getDefaultTwoFactorMethod() != null ? user.getDefaultTwoFactorMethod().name() : null)
                .forcePasswordReset(user.getForcePasswordReset())
                .requireSelfieVerification(user.getRequireSelfieVerification())
                .notificationPreferences(user.getNotificationPreferences())
                .language(user.getLanguage())
                .theme(user.getTheme())
                .homeBackground(user.getHomeBackground())
                .hubBackground(user.getHubBackground())
                .scheduledDeletionAt(user.getScheduledDeletionAt() != null ? user.getScheduledDeletionAt().toString() : null)
                .silentHoursEnabled(user.getSilentHoursEnabled())
                .silentHoursStart(user.getSilentHoursStart())
                .silentHoursEnd(user.getSilentHoursEnd())
                .silentHoursPaymentThreshold(user.getSilentHoursPaymentThreshold())
                .build();
    }

    public AuthResponse.UserInfo updateProfile(User user, UpdateProfileRequest request) {
        if (request.getFirstName() != null) user.setFirstName(request.getFirstName());
        if (request.getLastName() != null) user.setLastName(request.getLastName());
        
        if (request.getEmail() != null && !request.getEmail().equals(user.getEmail())) {
            if (userRepository.existsByEmail(request.getEmail())) {
                throw new AppException("Email is already registered");
            }
            user.setEmail(request.getEmail());
        }

        if (request.getPhone() != null && !request.getPhone().equals(user.getPhoneNumber())) {
            if (userRepository.existsByPhoneNumber(request.getPhone())) {
                throw new AppException("Phone number is already registered");
            }
            user.setPhoneNumber(request.getPhone());
        }

        if (request.getPronouns() != null) user.setPronouns(request.getPronouns());
        if (request.getHomeAddress() != null) user.setHomeAddress(request.getHomeAddress());
        if (request.getCity() != null) user.setCity(request.getCity());
        if (request.getNationality() != null) user.setNationality(request.getNationality());
        if (request.getOtherNationality() != null) user.setOtherNationality(request.getOtherNationality());
        if (request.getIsTaxResidentAbroad() != null) user.setIsTaxResidentAbroad(request.getIsTaxResidentAbroad());
        if (request.getTaxCountry() != null) user.setTaxCountry(request.getTaxCountry());
        if (request.getIsUSPerson() != null) user.setIsUSPerson(request.getIsUSPerson());

        if (request.getHandle() != null) {
            String newHandle = request.getHandle().toLowerCase();
            if (!HANDLE_PATTERN.matcher(newHandle).matches()) {
                throw new AppException("Handle must be 3-30 characters and contain only lowercase letters, numbers, and underscores");
            }
            if (!newHandle.equals(user.getUsername()) && userRepository.existsByUsername(newHandle)) {
                throw new AppException("Handle is already taken");
            }
            user.setUsername(newHandle);
        }
        
        if (request.getLanguage() != null) user.setLanguage(request.getLanguage());
        if (request.getTheme() != null) user.setTheme(request.getTheme());
        if (request.getHomeBackground() != null) updateHomeBackground(user, request.getHomeBackground());
        if (request.getHubBackground() != null) updateHubBackground(user, request.getHubBackground());

        if (request.getProfileImageUrl() != null) {
            String url = request.getProfileImageUrl();
            if (!url.startsWith("https://api.navii.dev/")) {
                throw new AppException("INVALID_AVATAR_URL", "Avatar URL must be from api.navii.dev", HttpStatus.BAD_REQUEST);
            }
            user.setProfileImageUrl(url);
        }

        applyDateOfBirthAndEmployment(user, request.getDateOfBirth(), request.getEmploymentStatus());

        user = userRepository.save(user);
        return getProfile(user);
    }

    // ==================== EMAIL & PHONE CHANGE ====================

    private void requestCredentialChange(User user, String newValue, String conflictCode, String conflictMsg, String otpType, String alertMsg, java.util.function.BooleanSupplier existsCheck) {
        if (existsCheck.getAsBoolean()) {
            throw new AppException(conflictCode, conflictMsg, HttpStatus.CONFLICT);
        }
        otpService.sendOtp(newValue, otpType);
        notificationService.sendGenericSecurityAlert(user.getId(), "Account Security", alertMsg);
    }

    public void requestEmailChange(User user, String newEmail) {
        String normalized = newEmail.toLowerCase().trim();
        requestCredentialChange(user, normalized, "EMAIL_ALREADY_EXISTS", 
            "This email address is already registered with another account", "change_email",
            "A request to change your email address to " + normalized + " was initiated. If this wasn't you, secure your account immediately.",
            () -> userRepository.existsByEmail(normalized));
    }

    @Transactional
    public AuthResponse.UserInfo verifyEmailChange(User user, String newEmail, String code) {
        String normalized = newEmail.toLowerCase().trim();
        otpService.verifyOtp(normalized, code, "change_email");
        user.setEmail(normalized);
        return getProfile(userRepository.save(user));
    }

    public void requestPhoneChange(User user, String newPhone) {
        String normalized = newPhone.trim();
        requestCredentialChange(user, normalized, "PHONE_ALREADY_EXISTS", 
            "This phone number is already registered with another account", "change_phone",
            "A request to change your phone number to " + normalized + " was initiated.",
            () -> userRepository.existsByPhoneNumber(normalized));
    }

    @Transactional
    public AuthResponse.UserInfo verifyPhoneChange(User user, String newPhone, String code) {
        String normalized = newPhone.trim();
        otpService.verifyOtp(normalized, code, "change_phone");
        user.setPhoneNumber(normalized);
        return getProfile(userRepository.save(user));
    }

    // ==================== PROFILE IMAGE ====================

    private byte[] validateAndGetBytes(MultipartFile file) {
        if (file.isEmpty()) {
            throw new AppException("File is empty");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new AppException("File size exceeds 5MB limit");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType)) {
            throw new AppException("Only JPEG and PNG images are accepted");
        }

        try {
            byte[] bytes = file.getBytes();
            if (!isValidImage(bytes)) {
                throw new AppException("Invalid image content. Only JPEG and PNG are allowed.");
            }
            return bytes;
        } catch (java.io.IOException e) {
            throw new AppException("Failed to read file content");
        }
    }

    @Transactional
    public AuthResponse.UserInfo uploadProfileImage(User user, MultipartFile file) {
        validateAndGetBytes(file);
        String imageUrl = cloudinaryService.uploadProfileImage(file);
        user.setProfileImageUrl(imageUrl);
        user = userRepository.save(user);
        return getProfile(user);
    }

    @Transactional
    public AuthResponse.UserInfo uploadHomeBackground(User user, MultipartFile file) {
        byte[] bytes = validateAndGetBytes(file);
        imageService.decrementReferenceCount(user.getHomeBackground());
        String newUrl = imageService.processAndDeduplicateImage(bytes, "aza/backgrounds/home");
        user.setHomeBackground(newUrl);
        user = userRepository.save(user);
        return getProfile(user);
    }

    @Transactional
    public AuthResponse.UserInfo uploadHubBackground(User user, MultipartFile file) {
        byte[] bytes = validateAndGetBytes(file);
        imageService.decrementReferenceCount(user.getHubBackground());
        String newUrl = imageService.processAndDeduplicateImage(bytes, "aza/backgrounds/hub");
        user.setHubBackground(newUrl);
        user = userRepository.save(user);
        return getProfile(user);
    }

    @SuppressWarnings("HttpUrlsUsage")
    private boolean isExternalUrl(String url) {
        if (url == null) return false;
        String lower = url.toLowerCase();
        return (lower.startsWith("http://") || lower.startsWith("https://")) && !lower.contains("res.cloudinary.com");
    }

    private void updateHomeBackground(User user, String newUrl) {
        String oldUrl = user.getHomeBackground();
        if (newUrl == null || !newUrl.equals(oldUrl)) {
            imageService.decrementReferenceCount(oldUrl);
            user.setHomeBackground(isExternalUrl(newUrl) ? imageService.processExternalUrl(newUrl, "aza/backgrounds/home") : newUrl);
        }
    }

    private void updateHubBackground(User user, String newUrl) {
        String oldUrl = user.getHubBackground();
        if (newUrl == null || !newUrl.equals(oldUrl)) {
            imageService.decrementReferenceCount(oldUrl);
            user.setHubBackground(isExternalUrl(newUrl) ? imageService.processExternalUrl(newUrl, "aza/backgrounds/hub") : newUrl);
        }
    }

    // ==================== PUBLIC PROFILE ====================

    public PublicProfileResponse getPublicProfile(UUID userId) {
        User user = userRepository.findById(userId).orElse(null);
        if (user != null) {
            if (user.getStatus() == User.AccountStatus.DEACTIVATED) {
                throw new AppException("User not found");
            }
            return PublicProfileResponse.builder()
                    .id(user.getId().toString())
                    .displayName(user.getFirstName() + " " + user.getLastName())
                    .profileImageUrl(user.getProfileImageUrl())
                    .onlineStatus("OFFLINE")
                    .build();
        }

        Merchant merchant = merchantRepository.findById(userId).orElse(null);
        if (merchant != null) {
            if (merchant.getStatus() != Merchant.MerchantStatus.ACTIVE) {
                throw new AppException("User not found");
            }
            return PublicProfileResponse.builder()
                    .id(merchant.getId().toString())
                    .displayName(merchant.getBusinessName())
                    .username(merchant.getBusinessHandle())
                    .profileImageUrl(merchant.getLogoUrl())
                    .onlineStatus("OFFLINE")
                    .build();
        }

        throw new AppException("User not found");
    }

    public PublicProfileResponse getPublicProfileByUsername(String username) {
        User user = userRepository.findByUsername(username).orElse(null);
        if (user != null) {
            if (user.getStatus() == User.AccountStatus.DEACTIVATED) {
                throw new AppException("User not found");
            }
            return PublicProfileResponse.builder()
                    .id(user.getId().toString())
                    .displayName(user.getFirstName() + " " + user.getLastName())
                    .username(user.getUsername())
                    .profileImageUrl(user.getProfileImageUrl())
                    .onlineStatus("OFFLINE")
                    .build();
        }

        Merchant merchant = merchantRepository.findByBusinessHandle(username).orElse(null);
        if (merchant != null) {
            if (merchant.getStatus() != Merchant.MerchantStatus.ACTIVE) {
                throw new AppException("User not found");
            }
            return PublicProfileResponse.builder()
                    .id(merchant.getId().toString())
                    .displayName(merchant.getBusinessName())
                    .username(merchant.getBusinessHandle())
                    .profileImageUrl(merchant.getLogoUrl())
                    .onlineStatus("OFFLINE")
                    .build();
        }

        throw new AppException("User not found");
    }

    public org.springframework.data.domain.Page<PublicProfileResponse> searchUsers(String query, int page, int size) {
        if (query == null || query.isBlank()) return org.springframework.data.domain.Page.empty();
        
        String trimmed = query.trim();

        // 1. Try an exact phone match if it looks like a phone
        if (PHONE_PATTERN.matcher(trimmed).matches()) {
            String normalized = normalizePhone(trimmed);
            java.util.Optional<User> user = userRepository.findByPhoneNumberAndPrivacy(normalized);
            if (user.isPresent()) {
                return new org.springframework.data.domain.PageImpl<>(
                        List.of(toPublicProfileResponse(user.get())), 
                        org.springframework.data.domain.PageRequest.of(page, size), 1);
            }
        }

        // 2. Try an exact email match if it looks like an email
        if (EMAIL_PATTERN.matcher(trimmed).matches()) {
            java.util.Optional<User> user = userRepository.findByEmailAndPrivacy(trimmed.toLowerCase());
            if (user.isPresent()) {
                return new org.springframework.data.domain.PageImpl<>(
                        List.of(toPublicProfileResponse(user.get())), 
                        org.springframework.data.domain.PageRequest.of(page, size), 1);
            }
        }

        // 3. Fallback to general handle/name search (which respects findMeByHandle)
        return userRepository.searchUsers(trimmed, org.springframework.data.domain.PageRequest.of(page, size))
                .map(this::toPublicProfileResponse);
    }

    private PublicProfileResponse toPublicProfileResponse(User user) {
        return PublicProfileResponse.builder()
                .id(user.getId().toString())
                .displayName(user.getFirstName() + " " + user.getLastName())
                .username(user.getUsername())
                .profileImageUrl(user.getProfileImageUrl())
                .onlineStatus("OFFLINE")
                .build();
    }

    private String normalizePhone(String phone) {
        if (phone == null) return null;
        String p = phone.replaceAll("[\\s\\-()]", "");
        if (p.startsWith("0") && p.length() == 10) {
            return "+233" + p.substring(1);
        } else if (!p.startsWith("+")) {
            return "+" + p;
        }
        return p;
    }

    // ==================== PRIVACY ====================

    @Transactional
    public void updatePrivacySettings(User user, PrivacySettingsRequest request) {
        if (request.getFindMeByPhone() != null) {
            user.setFindMeByPhone(request.getFindMeByPhone());
        }
        if (request.getFindMeByEmail() != null) {
            user.setFindMeByEmail(request.getFindMeByEmail());
        }
        if (request.getFindMeByHandle() != null) {
            user.setFindMeByHandle(request.getFindMeByHandle());
        }
        if (request.getSyncContacts() != null) {
            user.setSyncContacts(request.getSyncContacts());
        }
        if (request.getShowOnlineStatus() != null) {
            user.setShowOnlineStatus(request.getShowOnlineStatus());
        }
        if (request.getBillForwardingEnabled() != null) {
            user.setBillForwardingEnabled(request.getBillForwardingEnabled());
        }
        if (request.getBiometricsEnabled() != null) {
            user.setBiometricsEnabled(request.getBiometricsEnabled());
        }
        if (request.getPasskeysEnabled() != null) {
            user.setPasskeysEnabled(request.getPasskeysEnabled());
            if (Boolean.TRUE.equals(request.getPasskeysEnabled())) {
                user.setTwoFactorEnabled(true);
                if (user.getDefaultTwoFactorMethod() == null) {
                    user.setDefaultTwoFactorMethod(com.aza.backend.entity.User.TwoFactorMethod.PASSKEY);
                }
            } else {
                // Only turn off twoFactorEnabled if no other method is still active
                boolean anyOtherEnabled = user.getTwoFactorSecret() != null
                        || Boolean.TRUE.equals(user.getSmsTwoFactorEnabled())
                        || Boolean.TRUE.equals(user.getEmailTwoFactorEnabled())
                        || Boolean.TRUE.equals(user.getAppTwoFactorEnabled());
                if (!anyOtherEnabled) {
                    user.setTwoFactorEnabled(false);
                }
                if (com.aza.backend.entity.User.TwoFactorMethod.PASSKEY.equals(user.getDefaultTwoFactorMethod())) {
                    user.setDefaultTwoFactorMethod(null);
                }
            }
        }
        userRepository.save(user);
    }

    @Transactional
    public void removeSelfEverywhere(User user) {
        user.setFindMeByPhone(false);
        user.setFindMeByEmail(false);
        user.setFindMeByHandle(false);
        user.setSyncContacts(false);
        userRepository.save(user);
    }

    // ==================== NOTIFICATIONS ====================

    @Transactional
    public void updateNotificationPreferences(User user, String preferencesJson) {
        user.setNotificationPreferences(preferencesJson);
        userRepository.save(user);
    }

    // ==================== DELETE (SOFT) ====================

    /**
     * Schedules the account for erasure in 30 days (GDPR right-to-erasure with grace period).
     * The user is immediately logged out. GdprErasureService runs the actual wipe after the
     * grace period so the user can cancel within 30 days.
     */
    @Transactional
    public void requestAccountDeletion(User user, String accessToken) {
        java.time.LocalDateTime deletionDate = java.time.LocalDateTime.now().plusDays(30);
        user.setStatus(User.AccountStatus.PENDING_DELETION);
        user.setScheduledDeletionAt(deletionDate);
        userRepository.save(user);

        // Revoke all active sessions — user must re-authenticate to cancel
        refreshTokenRepository.deleteAllByUserId(user.getId());

        if (accessToken != null && accessToken.startsWith("Bearer ")) {
            String token = accessToken.substring(7);
            Duration remaining = jwtUtil.getRemainingValidity(token);
            if (!remaining.isZero()) {
                redisTemplate.opsForValue().set(
                        BLACKLIST_PREFIX + hashToken(token), "pending_deletion", remaining);
            }
        }

        emailService.sendDeletionScheduledEmail(user.getEmail(), user.getFirstName(), deletionDate);
        if (user.getPhoneNumber() != null && !user.getPhoneNumber().isBlank()) {
            smsService.sendDeletionScheduledSms(user.getPhoneNumber(), deletionDate);
        }
    }

    /**
     * Cancels a pending deletion within the 30-day grace period.
     */
    @Transactional
    public void cancelAccountDeletion(User user) {
        if (user.getStatus() != User.AccountStatus.PENDING_DELETION) {
            throw new com.aza.backend.exception.AppException("No pending deletion request found");
        }
        user.setStatus(User.AccountStatus.ACTIVE);
        user.setScheduledDeletionAt(null);
        userRepository.save(user);

        emailService.sendDeletionCancelledEmail(user.getEmail(), user.getFirstName());
        if (user.getPhoneNumber() != null && !user.getPhoneNumber().isBlank()) {
            smsService.sendDeletionCancelledSms(user.getPhoneNumber());
        }
    }

    // ==================== DEACTIVATE ====================

    @Transactional
    public void deactivateAccount(User user, DeactivateRequest request, String accessToken) {
        user.setStatus(User.AccountStatus.DEACTIVATED);
        user.setDeactivationReason(request.getReason());
        userRepository.save(user);

        // Invalidate all refresh tokens (logout everywhere)
        refreshTokenRepository.deleteAllByUserId(user.getId());

        // Blacklist the current access token for its remaining validity
        if (accessToken != null && accessToken.startsWith("Bearer ")) {
            String token = accessToken.substring(7);
            Duration remaining = jwtUtil.getRemainingValidity(token);
            if (!remaining.isZero()) {
                redisTemplate.opsForValue().set(
                        BLACKLIST_PREFIX + hashToken(token), "blacklisted", remaining);
            }
        }
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new AppException("SHA-256 not available", e);
        }
    }

    // ==================== SILENT HOURS ====================

    @Transactional
    public void updateSilentHours(User user, SilentHoursRequest request) {
        if (Boolean.TRUE.equals(request.getEnabled())) {
            if (request.getStartTime() == null || request.getEndTime() == null) {
                throw new AppException("startTime and endTime are required when enabling silent hours");
            }
        }
        user.setSilentHoursEnabled(request.getEnabled());
        user.setSilentHoursStart(request.getStartTime());
        user.setSilentHoursEnd(request.getEndTime());
        user.setSilentHoursPaymentThreshold(request.getPaymentThreshold());
        userRepository.save(user);
    }

    // ==================== DEVICES ====================

    public List<DeviceResponse> getDevices(User user, String currentDeviceId) {
        return refreshTokenRepository.findAllByUserId(user.getId())
                .stream()
                .filter(token -> !token.isExpired())
                .sorted((a, b) -> {
                    // Pin the current device to the top, then most-recently-active first.
                    boolean aCurrent = currentDeviceId != null && currentDeviceId.equals(a.getDeviceId());
                    boolean bCurrent = currentDeviceId != null && currentDeviceId.equals(b.getDeviceId());
                    if (aCurrent != bCurrent) return aCurrent ? -1 : 1;
                    return lastActive(b).compareTo(lastActive(a));
                })
                .map(token -> DeviceResponse.builder()
                        .id(token.getId().toString())
                        .deviceId(token.getDeviceId())
                        .deviceName(token.getDeviceName())
                        .deviceOs(token.getDeviceOs())
                        .ipAddress(token.getIpAddress())
                        .location(token.getLocation())
                        .createdAt(token.getCreatedAt())
                        .lastUsedAt(lastActive(token))
                        .currentDevice(currentDeviceId != null && currentDeviceId.equals(token.getDeviceId()))
                        .online(presenceService.isSessionOnline(token.getId()))
                        .build())
                .toList();
    }

    private static java.time.LocalDateTime lastActive(RefreshToken token) {
        return token.getLastUsedAt() != null ? token.getLastUsedAt() : token.getCreatedAt();
    }

    @Transactional
    public void removeDevice(User user, UUID deviceId) {
        RefreshToken token = refreshTokenRepository.findByIdAndUserId(deviceId, user.getId())
                .orElseThrow(() -> new AppException("Device not found or does not belong to this account"));

        // Immediately blacklist the paired access token so the device is logged out right now,
        // not just when its JWT naturally expires.
        if (token.getAccessTokenHash() != null && token.getAccessTokenExpiresAt() != null) {
            Duration remaining = Duration.between(java.time.LocalDateTime.now(), token.getAccessTokenExpiresAt());
            if (!remaining.isNegative() && !remaining.isZero()) {
                redisTemplate.opsForValue().set(
                        BLACKLIST_PREFIX + token.getAccessTokenHash(),
                        "revoked",
                        remaining);
            }
        }

        refreshTokenRepository.delete(token);
    }

    /** Purges expired refresh tokens every hour to keep the devices list clean. */
    @Scheduled(fixedRate = 3_600_000)
    @Transactional
    public void purgeExpiredRefreshTokens() {
        refreshTokenRepository.deleteByExpiresAtBefore(java.time.LocalDateTime.now());
    }

    // ==================== PASSCODE (PIN) ====================

    @Transactional
    public void setPasscode(User user, String passcode) {
        user.setPasscodeHash(passwordEncoder.encode(passcode));
        userRepository.save(user);
    }

    public void verifyPasscode(User user, String passcode) {
        if (user.getPasscodeHash() == null) {
            throw new AppException("Passcode not set. Please set a passcode first.");
        }

        String attemptsKey = "pin:attempts:" + user.getId();
        String attemptsStr = redisTemplate.opsForValue().get(attemptsKey);
        int attempts = attemptsStr != null ? Integer.parseInt(attemptsStr) : 0;

        if (attempts >= 5) {
            throw new AppException("Too many failed attempts. Try again in 5 minutes.");
        }

        if (!passwordEncoder.matches(passcode, user.getPasscodeHash())) {
            redisTemplate.opsForValue().set(attemptsKey,
                    String.valueOf(attempts + 1), 5, TimeUnit.MINUTES);
            throw new AppException("Invalid passcode.");
        }

        redisTemplate.delete(attemptsKey);
    }

    public void applyDateOfBirthAndEmployment(User user, String dob, String employmentStatus) {
        if (dob != null && !dob.isBlank()) {
            LocalDate birthDate = LocalDate.parse(dob);
            if (birthDate.isAfter(LocalDate.now().minusYears(18))) {
                throw new AppException("You must be at least 18 years old to register.");
            }
            if (birthDate.isBefore(LocalDate.now().minusYears(120))) {
                throw new AppException("Invalid date of birth.");
            }
            user.setDateOfBirth(birthDate);
        }
        if (employmentStatus != null && !employmentStatus.isBlank()) {
            user.setEmploymentStatus(
                    User.EmploymentStatus.valueOf(employmentStatus.toUpperCase()));
        }
    }
    
    private boolean isFieldAvailable(String value, Pattern pattern, java.util.function.Predicate<String> existsFunc) {
        if (value == null || value.isBlank()) return false;
        String normalized = value.toLowerCase().trim();
        if (!pattern.matcher(normalized).matches()) return false;
        return !existsFunc.test(normalized);
    }

    public boolean isUsernameAvailable(String username) {
        return isFieldAvailable(username, HANDLE_PATTERN, userRepository::existsByUsername);
    }

    public boolean isEmailAvailable(String email) {
        return isFieldAvailable(email, EMAIL_PATTERN, userRepository::existsByEmail);
    }

    public boolean isPhoneAvailable(String phone) {
        if (phone == null || phone.isBlank()) return false;
        String normalized = normalizePhone(phone);
        if (normalized == null || !PHONE_PATTERN.matcher(normalized).matches()) {
            return false;
        }
        return !userRepository.existsByPhoneNumber(normalized);
    }

    public List<String> suggestUsernames(String firstName, String lastName) {
        String base = (firstName + lastName).replaceAll("[^a-z0-9]", "").toLowerCase();
        if (base.isEmpty()) base = "user";
        
        List<String> suggestions = new java.util.ArrayList<>();
        int suffix = 1;
        while (suggestions.size() < 3 && suffix < 1000) {
            String candidate = base + suffix;
            if (candidate.length() >= 3 && !userRepository.existsByUsername(candidate)) {
                suggestions.add(candidate);
            }
            suffix++;
        }
        
        // Add some more variations if we need 3
        if (suggestions.size() < 3 && !firstName.isEmpty() && !lastName.isEmpty()) {
            String altBase = firstName.toLowerCase().replaceAll("[^a-z0-9]", "") + "_" + lastName.toLowerCase().replaceAll("[^a-z0-9]", "");
            if (altBase.length() >= 3 && altBase.length() <= 30 && !userRepository.existsByUsername(altBase)) {
                suggestions.add(altBase);
            }
        }
        
        return suggestions;
    }

    public User findById(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new AppException("User not found"));
    }

    private boolean isValidImage(byte[] bytes) {
        if (bytes.length < 4) return false;
        
        // JPEG: FF D8 FF
        if (bytes[0] == (byte) 0xFF && bytes[1] == (byte) 0xD8 && bytes[2] == (byte) 0xFF) {
            return true;
        }
        
        // PNG: 89 50 4E 47
        return bytes[0] == (byte) 0x89 && bytes[1] == (byte) 0x50 && bytes[2] == (byte) 0x4E && bytes[3] == (byte) 0x47;
    }
}
