package com.aza.backend.service;

import com.aza.backend.dto.admin.StaffMemberResponse;
import com.aza.backend.entity.StaffRole;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.StaffRoleRepository;
import com.aza.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Back-office privilege management. Staff are regular AZA users; their powers
 * live in staff_roles as grant/revoke history, not on the users row. The legacy
 * users.role enum is honored as a bootstrap bridge (an enum ADMIN counts as a
 * staff ADMIN until V12 seeds the table) and kept in sync on ADMIN grant/revoke
 * for anything that still reads it.
 */
@Service
@RequiredArgsConstructor
public class StaffRoleService {

    private final StaffRoleRepository staffRoleRepository;
    private final UserRepository userRepository;
    private final AdminAuditService auditService;

    /**
     * Roles that authorization should honor for this user. ADMIN implies every
     * other staff role, so admin endpoints can check the specific role they need
     * without listing ADMIN everywhere.
     */
    public Set<StaffRole.Role> getEffectiveRoles(User user) {
        Set<StaffRole.Role> roles = getActiveRoles(user);
        if (roles.contains(StaffRole.Role.ADMIN)) {
            roles.addAll(EnumSet.allOf(StaffRole.Role.class));
        }
        return roles;
    }

    /** Roles actually held (no ADMIN expansion) — what UIs should display. */
    public Set<StaffRole.Role> getActiveRoles(User user) {
        Set<StaffRole.Role> roles = EnumSet.noneOf(StaffRole.Role.class);
        staffRoleRepository.findByUserIdAndRevokedAtIsNull(user.getId())
                .forEach(r -> roles.add(r.getRole()));
        if (user.getRole() == User.UserRole.ADMIN) {
            roles.add(StaffRole.Role.ADMIN);
        }
        return roles;
    }

    @Transactional
    public StaffMemberResponse grantRole(User admin, UUID targetUserId, StaffRole.Role role) {
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new AppException("USER_NOT_FOUND", "User not found", HttpStatus.NOT_FOUND));

        if (staffRoleRepository.findFirstByUserIdAndRoleAndRevokedAtIsNull(targetUserId, role).isPresent()) {
            throw new AppException("ROLE_ALREADY_GRANTED", "User already holds " + role, HttpStatus.CONFLICT);
        }

        staffRoleRepository.save(StaffRole.builder()
                .userId(targetUserId)
                .role(role)
                .grantedBy(admin.getId())
                .build());

        if (role == StaffRole.Role.ADMIN && target.getRole() != User.UserRole.ADMIN) {
            target.setRole(User.UserRole.ADMIN);
            userRepository.save(target);
        }

        auditService.log(admin, "GRANT_STAFF_ROLE", target, "role=" + role);
        return toStaffMember(target, staffRoleRepository.findByUserIdAndRevokedAtIsNull(targetUserId));
    }

    @Transactional
    public StaffMemberResponse revokeRole(User admin, UUID targetUserId, StaffRole.Role role) {
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new AppException("USER_NOT_FOUND", "User not found", HttpStatus.NOT_FOUND));

        if (role == StaffRole.Role.ADMIN && isLastAdmin(targetUserId)) {
            throw new AppException("LAST_ADMIN", "Cannot revoke the last ADMIN — grant another first", HttpStatus.CONFLICT);
        }

        StaffRole grant = staffRoleRepository.findFirstByUserIdAndRoleAndRevokedAtIsNull(targetUserId, role)
                .orElse(null);
        boolean legacyOnly = grant == null;
        if (legacyOnly && !(role == StaffRole.Role.ADMIN && target.getRole() == User.UserRole.ADMIN)) {
            throw new AppException("ROLE_NOT_HELD", "User does not hold " + role, HttpStatus.NOT_FOUND);
        }

        if (grant != null) {
            grant.setRevokedAt(LocalDateTime.now());
            grant.setRevokedBy(admin.getId());
            staffRoleRepository.save(grant);
        }

        if (role == StaffRole.Role.ADMIN && target.getRole() == User.UserRole.ADMIN) {
            target.setRole(User.UserRole.USER);
            userRepository.save(target);
        }

        auditService.log(admin, "REVOKE_STAFF_ROLE", target, "role=" + role);
        return toStaffMember(target, staffRoleRepository.findByUserIdAndRevokedAtIsNull(targetUserId));
    }

    /**
     * Legacy USER/ADMIN toggle from the old enum endpoint, expressed as staff-role
     * grant/revoke. Idempotent: setting a state the user already has is a no-op.
     */
    @Transactional
    public void setLegacyRole(User admin, UUID targetUserId, String newRole) {
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new AppException("USER_NOT_FOUND", "User not found", HttpStatus.NOT_FOUND));
        boolean isAdmin = getActiveRoles(target).contains(StaffRole.Role.ADMIN);
        if ("ADMIN".equalsIgnoreCase(newRole) && !isAdmin) {
            grantRole(admin, targetUserId, StaffRole.Role.ADMIN);
        } else if ("USER".equalsIgnoreCase(newRole) && isAdmin) {
            revokeRole(admin, targetUserId, StaffRole.Role.ADMIN);
        }
    }

    public List<StaffMemberResponse> listStaff() {
        Map<UUID, List<StaffRole>> byUser = staffRoleRepository.findByRevokedAtIsNull().stream()
                .collect(Collectors.groupingBy(StaffRole::getUserId));

        // Legacy enum admins not yet seeded into staff_roles still appear in the list
        userRepository.findByRole(User.UserRole.ADMIN)
                .forEach(u -> byUser.computeIfAbsent(u.getId(), k -> new ArrayList<>()));

        List<StaffMemberResponse> result = new ArrayList<>();
        for (Map.Entry<UUID, List<StaffRole>> entry : byUser.entrySet()) {
            User user = userRepository.findById(entry.getKey()).orElse(null);
            if (user == null) continue;
            result.add(toStaffMember(user, entry.getValue()));
        }
        result.sort(Comparator.comparing(StaffMemberResponse::getName, String.CASE_INSENSITIVE_ORDER));
        return result;
    }

    private boolean isLastAdmin(UUID targetUserId) {
        boolean otherStaffAdmin = staffRoleRepository.findByRevokedAtIsNull().stream()
                .anyMatch(r -> r.getRole() == StaffRole.Role.ADMIN && !r.getUserId().equals(targetUserId));
        boolean otherLegacyAdmin = userRepository.findByRole(User.UserRole.ADMIN).stream()
                .anyMatch(u -> !u.getId().equals(targetUserId));
        return !otherStaffAdmin && !otherLegacyAdmin;
    }

    private StaffMemberResponse toStaffMember(User user, List<StaffRole> grants) {
        Set<StaffRole.Role> seen = EnumSet.noneOf(StaffRole.Role.class);
        List<StaffMemberResponse.RoleGrant> roles = new ArrayList<>();
        for (StaffRole grant : grants) {
            seen.add(grant.getRole());
            roles.add(StaffMemberResponse.RoleGrant.builder()
                    .role(grant.getRole().name())
                    .grantedAt(grant.getGrantedAt() != null ? grant.getGrantedAt().toString() : null)
                    .grantedByEmail(grant.getGrantedBy() != null
                            ? userRepository.findById(grant.getGrantedBy()).map(User::getEmail).orElse(null)
                            : null)
                    .build());
        }
        if (user.getRole() == User.UserRole.ADMIN && !seen.contains(StaffRole.Role.ADMIN)) {
            roles.add(StaffMemberResponse.RoleGrant.builder()
                    .role(StaffRole.Role.ADMIN.name())
                    .grantedAt(null)
                    .grantedByEmail(null)
                    .build());
        }
        return StaffMemberResponse.builder()
                .userId(user.getId().toString())
                .name((user.getFirstName() + " " + user.getLastName()).trim())
                .email(user.getEmail())
                .handle(user.getUsername())
                .profileImageUrl(user.getProfileImageUrl())
                .roles(roles)
                .build();
    }
}
