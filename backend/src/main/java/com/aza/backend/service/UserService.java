package com.aza.backend.service;

import com.aza.backend.dto.auth.AuthResponse;
import com.aza.backend.dto.user.UpdateProfileRequest;
import com.aza.backend.entity.User;
import com.aza.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    public AuthResponse.UserInfo getProfile(User user) {
        return AuthResponse.UserInfo.builder()
                .id(user.getId().toString())
                .email(user.getEmail())
                .phone(user.getPhone())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .displayName(user.getDisplayName())
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

        if (request.getDateOfBirth() != null && !request.getDateOfBirth().isBlank()) {
            user.setDateOfBirth(LocalDate.parse(request.getDateOfBirth()));
        }
        if (request.getEmploymentStatus() != null && !request.getEmploymentStatus().isBlank()) {
            user.setEmploymentStatus(
                    User.EmploymentStatus.valueOf(request.getEmploymentStatus().toUpperCase()));
        }

        user = userRepository.save(user);
        return getProfile(user);
    }
}
