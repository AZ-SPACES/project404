package com.aza.backend.service;

import com.aza.backend.dto.auth.AuthResponse;
import com.aza.backend.dto.user.*;
import com.aza.backend.entity.RefreshToken;
import com.aza.backend.entity.User;
import com.aza.backend.repository.RefreshTokenRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.util.CloudinaryService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
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

    private static final long MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    private static final List<String> ALLOWED_CONTENT_TYPES = List.of("image/jpeg", "image/png");
    private static final Pattern HANDLE_PATTERN = Pattern.compile("^[a-z0-9_]{3,30}$");

    // ==================== PROFILE ====================

    public AuthResponse.UserInfo getProfile(User user) {
        return AuthResponse.UserInfo.builder()
                .id(user.getId().toString())
                .email(user.getEmail())
                .phone(user.getPhone())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .displayName(user.getDisplayName())
                .handle(user.getHandle())
                .profileImageUrl(user.getProfileImageUrl())
                .kycStatus(user.getKycStatus().name())
                .passcodeSet(user.getPasscodeHash() != null)
                .build();
    }

    public AuthResponse.UserInfo updateProfile(User user, UpdateProfileRequest request) {
        if (request.getFirstName() != null) user.setFirstName(request.getFirstName());
        if (request.getLastName() != null) user.setLastName(request.getLastName());
        if (request.getDisplayName() != null) user.setDisplayName(request.getDisplayName());
        if (request.getPronouns() != null) user.setPronouns(request.getPronouns());
        if (request.getHomeAddress() != null) user.setHomeAddress(request.getHomeAddress());
        if (request.getCity() != null) user.setCity(request.getCity());
        if (request.getNationality() != null) user.setNationality(request.getNationality());

        if (request.getHandle() != null) {
            String newHandle = request.getHandle().toLowerCase();
            if (!HANDLE_PATTERN.matcher(newHandle).matches()) {
                throw new RuntimeException("Handle must be 3-30 characters and contain only lowercase letters, numbers, and underscores");
            }
            if (!newHandle.equals(user.getHandle()) && userRepository.existsByHandle(newHandle)) {
                throw new RuntimeException("Handle is already taken");
            }
            user.setHandle(newHandle);
        }

        applyDateOfBirthAndEmployment(user, request.getDateOfBirth(), request.getEmploymentStatus());

        user = userRepository.save(user);
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

    // ==================== PUBLIC PROFILE ====================

    public PublicProfileResponse getPublicProfile(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (user.getStatus() == User.AccountStatus.DEACTIVATED) {
            throw new RuntimeException("User not found");
        }

        return PublicProfileResponse.builder()
                .id(user.getId().toString())
                .displayName(user.getDisplayName())
                .profileImageUrl(user.getProfileImageUrl())
                .onlineStatus("OFFLINE") // Default to OFFLINE for privacy until contacts system is built
                .build();
    }

    public PublicProfileResponse getPublicProfileByHandle(String handle) {
        User user = userRepository.findByHandle(handle)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (user.getStatus() == User.AccountStatus.DEACTIVATED) {
            throw new RuntimeException("User not found");
        }

        return PublicProfileResponse.builder()
                .id(user.getId().toString())
                .displayName(user.getDisplayName())
                .profileImageUrl(user.getProfileImageUrl())
                .onlineStatus("OFFLINE") // Default to OFFLINE for privacy until contacts system is built
                .build();
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
        userRepository.save(user);
    }

    // ==================== NOTIFICATIONS ====================

    @Transactional
    public void updateNotificationPreferences(User user, String preferencesJson) {
        user.setNotificationPreferences(preferencesJson);
        userRepository.save(user);
    }

    // ==================== DEACTIVATE ====================

    @Transactional
    public void deactivateAccount(User user, DeactivateRequest request, String accessToken) {
        user.setStatus(User.AccountStatus.DEACTIVATED);
        user.setDeactivationReason(request.getReason());
        userRepository.save(user);

        // Invalidate all refresh tokens (logout everywhere)
        refreshTokenRepository.deleteAllByUserId(user.getId());

        // Blacklist the current access token in Redis for 15 minutes
        if (accessToken != null && accessToken.startsWith("Bearer ")) {
            String token = accessToken.substring(7);
            redisTemplate.opsForValue().set("blacklist:" + token, "true", 15, TimeUnit.MINUTES);
        }
    }

    // ==================== DEVICES ====================

    public List<DeviceResponse> getDevices(User user) {
        List<RefreshToken> tokens = refreshTokenRepository.findAllByUserId(user.getId());
        return tokens.stream()
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
                .orElseThrow(() -> new RuntimeException("Device not found"));
        refreshTokenRepository.delete(token);
    }

    public void applyDateOfBirthAndEmployment(User user, String dob, String employmentStatus) {
        if (dob != null && !dob.isBlank()) {
            user.setDateOfBirth(LocalDate.parse(dob));
        }
        if (employmentStatus != null && !employmentStatus.isBlank()) {
            user.setEmploymentStatus(
                    User.EmploymentStatus.valueOf(employmentStatus.toUpperCase()));
        }
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
