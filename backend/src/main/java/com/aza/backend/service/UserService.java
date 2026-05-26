package com.aza.backend.service;

import com.aza.backend.dto.auth.AuthResponse;
import com.aza.backend.dto.user.*;
import com.aza.backend.dto.user.SilentHoursRequest;
import com.aza.backend.entity.RefreshToken;
import com.aza.backend.entity.User;
import com.aza.backend.repository.RefreshTokenRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.security.JwtUtil;
import com.aza.backend.util.CloudinaryService;
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
    private final RefreshTokenRepository refreshTokenRepository;
    private final CloudinaryService cloudinaryService;
    private final StringRedisTemplate redisTemplate;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final OtpService otpService;
    private final NotificationService notificationService;
    private final ImageService imageService;

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
                .billForwardingEnabled(user.getBillForwardingEnabled())
                .twoFactorEnabled(user.getTwoFactorEnabled())
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
                .build();
    }

    public AuthResponse.UserInfo updateProfile(User user, UpdateProfileRequest request) {
        if (request.getFirstName() != null) user.setFirstName(request.getFirstName());
        if (request.getLastName() != null) user.setLastName(request.getLastName());
        
        if (request.getEmail() != null && !request.getEmail().equals(user.getEmail())) {
            if (userRepository.existsByEmail(request.getEmail())) {
                throw new RuntimeException("Email is already registered");
            }
            user.setEmail(request.getEmail());
        }

        if (request.getPhone() != null && !request.getPhone().equals(user.getPhoneNumber())) {
            if (userRepository.existsByPhoneNumber(request.getPhone())) {
                throw new RuntimeException("Phone number is already registered");
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
                throw new RuntimeException("Handle must be 3-30 characters and contain only lowercase letters, numbers, and underscores");
            }
            if (!newHandle.equals(user.getUsername()) && userRepository.existsByUsername(newHandle)) {
                throw new RuntimeException("Handle is already taken");
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

    public void requestEmailChange(User user, String newEmail) {
        if (userRepository.existsByEmail(newEmail.toLowerCase().trim())) {
            throw new com.aza.backend.exception.AppException("EMAIL_ALREADY_EXISTS", "This email address is already registered with another account", org.springframework.http.HttpStatus.CONFLICT);
        }
        // Send OTP to the NEW email
        otpService.sendOtp(newEmail.toLowerCase().trim(), "change_email");
        
        // Notify the OLD email (security alert)
        notificationService.sendGenericSecurityAlert(user.getId(), "Account Security", 
            "A request to change your email address to " + newEmail + " was initiated. If this wasn't you, secure your account immediately.");
    }

    @Transactional
    public AuthResponse.UserInfo verifyEmailChange(User user, String newEmail, String code) {
        otpService.verifyOtp(newEmail.toLowerCase().trim(), code, "change_email");
        user.setEmail(newEmail.toLowerCase().trim());
        userRepository.save(user);
        return getProfile(user);
    }

    public void requestPhoneChange(User user, String newPhone) {
        if (userRepository.existsByPhoneNumber(newPhone.trim())) {
            throw new com.aza.backend.exception.AppException("PHONE_ALREADY_EXISTS", "This phone number is already registered with another account", org.springframework.http.HttpStatus.CONFLICT);
        }
        // Send OTP to the NEW phone
        otpService.sendOtp(newPhone.trim(), "change_phone");
        
        // Notify current user (security alert)
        notificationService.sendGenericSecurityAlert(user.getId(), "Account Security", 
            "A request to change your phone number to " + newPhone + " was initiated.");
    }

    @Transactional
    public AuthResponse.UserInfo verifyPhoneChange(User user, String newPhone, String code) {
        otpService.verifyOtp(newPhone.trim(), code, "change_phone");
        user.setPhoneNumber(newPhone.trim());
        userRepository.save(user);
        return getProfile(user);
    }

    // ==================== PROFILE IMAGE ====================

    @Transactional
    public AuthResponse.UserInfo uploadProfileImage(User user, MultipartFile file) {
        if (file.isEmpty()) {
            throw new RuntimeException("File is empty");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new RuntimeException("File size exceeds 5MB limit");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType)) {
            throw new RuntimeException("Only JPEG and PNG images are accepted");
        }

        try {
            if (!isValidImage(file.getBytes())) {
                throw new RuntimeException("Invalid image content. Only JPEG and PNG are allowed.");
            }
        } catch (java.io.IOException e) {
            throw new RuntimeException("Failed to read file content");
        }

        String imageUrl = cloudinaryService.uploadProfileImage(file);
        user.setProfileImageUrl(imageUrl);
        user = userRepository.save(user);
        return getProfile(user);
    }

    @Transactional
    public AuthResponse.UserInfo uploadHomeBackground(User user, MultipartFile file) {
        if (file.isEmpty()) {
            throw new RuntimeException("File is empty");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new RuntimeException("File size exceeds 5MB limit");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType)) {
            throw new RuntimeException("Only JPEG and PNG images are accepted");
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (java.io.IOException e) {
            throw new RuntimeException("Failed to read file content");
        }

        // Decrement reference count of previous background
        imageService.decrementReferenceCount(user.getHomeBackground());

        String newUrl = imageService.processAndDeduplicateImage(bytes, "aza/backgrounds/home");
        user.setHomeBackground(newUrl);
        user = userRepository.save(user);
        return getProfile(user);
    }

    @Transactional
    public AuthResponse.UserInfo uploadHubBackground(User user, MultipartFile file) {
        if (file.isEmpty()) {
            throw new RuntimeException("File is empty");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new RuntimeException("File size exceeds 5MB limit");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType)) {
            throw new RuntimeException("Only JPEG and PNG images are accepted");
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (java.io.IOException e) {
            throw new RuntimeException("Failed to read file content");
        }

        // Decrement reference count of previous background
        imageService.decrementReferenceCount(user.getHubBackground());

        String newUrl = imageService.processAndDeduplicateImage(bytes, "aza/backgrounds/hub");
        user.setHubBackground(newUrl);
        user = userRepository.save(user);
        return getProfile(user);
    }

    private boolean isExternalUrl(String url) {
        if (url == null) return false;
        String lower = url.toLowerCase();
        return (lower.startsWith("http://") || lower.startsWith("https://")) && !lower.contains("res.cloudinary.com");
    }

    private void updateHomeBackground(User user, String newUrl) {
        String oldUrl = user.getHomeBackground();
        if (newUrl == null || !newUrl.equals(oldUrl)) {
            imageService.decrementReferenceCount(oldUrl);
            if (isExternalUrl(newUrl)) {
                String processedUrl = imageService.processExternalUrl(newUrl, "aza/backgrounds/home");
                user.setHomeBackground(processedUrl);
            } else {
                user.setHomeBackground(newUrl);
            }
        }
    }

    private void updateHubBackground(User user, String newUrl) {
        String oldUrl = user.getHubBackground();
        if (newUrl == null || !newUrl.equals(oldUrl)) {
            imageService.decrementReferenceCount(oldUrl);
            if (isExternalUrl(newUrl)) {
                String processedUrl = imageService.processExternalUrl(newUrl, "aza/backgrounds/hub");
                user.setHubBackground(processedUrl);
            } else {
                user.setHubBackground(newUrl);
            }
        }
    }

    // ==================== PUBLIC PROFILE ====================

    public PublicProfileResponse getPublicProfile(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (user.getStatus() == User.AccountStatus.DEACTIVATED) {
            throw new RuntimeException("User not found");
        }

        return PublicProfileResponse.builder()
                .id(user.getId().toString())
                .displayName(user.getFirstName() + " " + user.getLastName())
                .profileImageUrl(user.getProfileImageUrl())
                .onlineStatus("OFFLINE") // Default to OFFLINE for privacy until contacts system is built
                .build();
    }

    public PublicProfileResponse getPublicProfileByUsername(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        if (user.getStatus() == User.AccountStatus.DEACTIVATED) {
            throw new RuntimeException("User not found");
        }

        return PublicProfileResponse.builder()
                .id(user.getId().toString())
                .displayName(user.getFirstName() + " " + user.getLastName())
                .username(user.getUsername())
                .profileImageUrl(user.getProfileImageUrl())
                .onlineStatus("OFFLINE")
                .build();
    }

    public org.springframework.data.domain.Page<PublicProfileResponse> searchUsers(String query, int page, int size) {
        if (query == null || query.isBlank()) return org.springframework.data.domain.Page.empty();
        
        String trimmed = query.trim();

        // 1. Try exact phone match if it looks like a phone
        if (PHONE_PATTERN.matcher(trimmed).matches()) {
            String normalized = normalizePhone(trimmed);
            java.util.Optional<User> user = userRepository.findByPhoneNumberAndPrivacy(normalized);
            if (user.isPresent()) {
                return new org.springframework.data.domain.PageImpl<>(
                        List.of(toPublicProfileResponse(user.get())), 
                        org.springframework.data.domain.PageRequest.of(page, size), 1);
            }
        }

        // 2. Try exact email match if it looks like an email
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
        if (request.getBillForwardingEnabled() != null) {
            user.setBillForwardingEnabled(request.getBillForwardingEnabled());
        }
        if (request.getBiometricsEnabled() != null) {
            user.setBiometricsEnabled(request.getBiometricsEnabled());
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

    @Transactional
    public void softDeleteAccount(User user, String accessToken) {
        String id = user.getId().toString();

        // Free unique fields so the same credentials can be re-registered later
        user.setEmail("deleted_" + id + "@aza.deleted");
        user.setPhoneNumber("deleted_" + id);
        user.setUsername(null);

        // Wipe PII and secrets
        user.setFirstName(null);
        user.setLastName(null);
        user.setDateOfBirth(null);
        user.setProfileImageUrl(null);
        user.setHomeAddress(null);
        user.setCity(null);
        user.setNationality(null);
        user.setOtherNationality(null);
        user.setTaxCountry(null);
        user.setPasswordHash("deleted");
        user.setPasscodeHash(null);
        user.setTwoFactorSecret(null);

        user.setDeletedAt(java.time.LocalDateTime.now());
        user.setStatus(User.AccountStatus.DEACTIVATED);
        userRepository.save(user);

        // Revoke all sessions
        refreshTokenRepository.deleteAllByUserId(user.getId());

        if (accessToken != null && accessToken.startsWith("Bearer ")) {
            String token = accessToken.substring(7);
            Duration remaining = jwtUtil.getRemainingValidity(token);
            if (!remaining.isZero()) {
                redisTemplate.opsForValue().set(
                        BLACKLIST_PREFIX + hashToken(token), "deleted", remaining);
            }
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
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    // ==================== SILENT HOURS ====================

    @Transactional
    public void updateSilentHours(User user, SilentHoursRequest request) {
        if (Boolean.TRUE.equals(request.getEnabled())) {
            if (request.getStartTime() == null || request.getEndTime() == null) {
                throw new RuntimeException("startTime and endTime are required when enabling silent hours");
            }
        }
        user.setSilentHoursEnabled(request.getEnabled());
        user.setSilentHoursStart(request.getStartTime());
        user.setSilentHoursEnd(request.getEndTime());
        user.setSilentHoursPaymentThreshold(request.getPaymentThreshold());
        userRepository.save(user);
    }

    // ==================== DEVICES ====================

    public List<DeviceResponse> getDevices(User user) {
        return refreshTokenRepository.findAllByUserId(user.getId())
                .stream()
                .filter(token -> !token.isExpired())
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .map(token -> DeviceResponse.builder()
                        .id(token.getId().toString())
                        .deviceName(token.getDeviceName())
                        .deviceOs(token.getDeviceOs())
                        .ipAddress(token.getIpAddress())
                        .createdAt(token.getCreatedAt())
                        .build())
                .toList();
    }

    @Transactional
    public void removeDevice(User user, UUID deviceId) {
        RefreshToken token = refreshTokenRepository.findByIdAndUserId(deviceId, user.getId())
                .orElseThrow(() -> new RuntimeException("Device not found or does not belong to this account"));

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
            throw new RuntimeException("Passcode not set. Please set a passcode first.");
        }

        String attemptsKey = "pin:attempts:" + user.getId();
        String attemptsStr = redisTemplate.opsForValue().get(attemptsKey);
        int attempts = attemptsStr != null ? Integer.parseInt(attemptsStr) : 0;

        if (attempts >= 5) {
            throw new RuntimeException("Too many failed attempts. Try again in 5 minutes.");
        }

        if (!passwordEncoder.matches(passcode, user.getPasscodeHash())) {
            redisTemplate.opsForValue().set(attemptsKey,
                    String.valueOf(attempts + 1), 5, TimeUnit.MINUTES);
            throw new RuntimeException("Invalid passcode.");
        }

        redisTemplate.delete(attemptsKey);
    }

    public void applyDateOfBirthAndEmployment(User user, String dob, String employmentStatus) {
        if (dob != null && !dob.isBlank()) {
            LocalDate birthDate = LocalDate.parse(dob);
            if (birthDate.isAfter(LocalDate.now().minusYears(18))) {
                throw new RuntimeException("You must be at least 18 years old to register.");
            }
            if (birthDate.isBefore(LocalDate.now().minusYears(120))) {
                throw new RuntimeException("Invalid date of birth.");
            }
            user.setDateOfBirth(birthDate);
        }
        if (employmentStatus != null && !employmentStatus.isBlank()) {
            user.setEmploymentStatus(
                    User.EmploymentStatus.valueOf(employmentStatus.toUpperCase()));
        }
    }
    
    public boolean isUsernameAvailable(String username) {
        if (username == null || username.isBlank()) return false;
        String normalized = username.toLowerCase().trim();
        if (!HANDLE_PATTERN.matcher(normalized).matches()) {
            return false;
        }
        return !userRepository.existsByUsername(normalized);
    }

    public boolean isEmailAvailable(String email) {
        if (email == null || email.isBlank()) return false;
        String normalized = email.toLowerCase().trim();
        if (!EMAIL_PATTERN.matcher(normalized).matches()) {
            return false;
        }
        return !userRepository.existsByEmail(normalized);
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
                .orElseThrow(() -> new RuntimeException("User not found"));
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
