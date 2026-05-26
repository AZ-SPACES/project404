package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.merchant.InviteTeamMemberRequest;
import com.aza.backend.dto.merchant.TeamMemberResponse;
import com.aza.backend.dto.merchant.UpdateTeamRoleRequest;
import com.aza.backend.entity.Merchant;
import com.aza.backend.entity.MerchantTeamMember;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.MerchantRepository;
import com.aza.backend.repository.MerchantTeamMemberRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/merchant/team")
@RequiredArgsConstructor
@Slf4j
public class MerchantTeamController {

    private final MerchantTeamMemberRepository teamMemberRepository;
    private final MerchantRepository merchantRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<List<TeamMemberResponse>>> listMembers(
            @AuthenticationPrincipal User user) {
        Merchant merchant = requireMerchant(user.getId());
        List<TeamMemberResponse> members = teamMemberRepository
                .findAllByMerchantIdOrderByInvitedAtDesc(merchant.getId())
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success(members));
    }

    @PostMapping("/invite")
    @Transactional
    public ResponseEntity<ApiResponse<TeamMemberResponse>> invite(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody InviteTeamMemberRequest request) {
        Merchant merchant = requireMerchant(user.getId());
        String email = request.getEmail().toLowerCase().trim();

        if (teamMemberRepository.existsByMerchantIdAndEmail(merchant.getId(), email)) {
            throw new AppException("ALREADY_EXISTS",
                    "A team member with this email already exists", HttpStatus.CONFLICT);
        }

        MerchantTeamMember.TeamRole role = MerchantTeamMember.TeamRole.VIEWER;
        if (request.getRole() != null && !request.getRole().isBlank()) {
            try {
                role = MerchantTeamMember.TeamRole.valueOf(request.getRole().toUpperCase());
            } catch (IllegalArgumentException e) {
                throw new AppException("INVALID_ROLE",
                        "Role must be ADMIN, DEVELOPER, or VIEWER", HttpStatus.BAD_REQUEST);
            }
        }

        MerchantTeamMember member = MerchantTeamMember.builder()
                .merchantId(merchant.getId())
                .email(email)
                .role(role)
                .status(MerchantTeamMember.TeamStatus.PENDING)
                .inviteToken(UUID.randomUUID().toString())
                .build();

        teamMemberRepository.save(member);
        log.info("Team member invited: merchantId={}, email={}, role={}", merchant.getId(), email, role);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(toResponse(member)));
    }

    @PutMapping("/{id}/role")
    @Transactional
    public ResponseEntity<ApiResponse<TeamMemberResponse>> updateRole(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id,
            @RequestBody UpdateTeamRoleRequest request) {
        Merchant merchant = requireMerchant(user.getId());
        MerchantTeamMember member = teamMemberRepository.findByIdAndMerchantId(id, merchant.getId())
                .orElseThrow(() -> new AppException("NOT_FOUND", "Team member not found", HttpStatus.NOT_FOUND));

        if (request.getRole() != null && !request.getRole().isBlank()) {
            try {
                member.setRole(MerchantTeamMember.TeamRole.valueOf(request.getRole().toUpperCase()));
            } catch (IllegalArgumentException e) {
                throw new AppException("INVALID_ROLE",
                        "Role must be ADMIN, DEVELOPER, or VIEWER", HttpStatus.BAD_REQUEST);
            }
        }

        teamMemberRepository.save(member);
        return ResponseEntity.ok(ApiResponse.success(toResponse(member)));
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<ApiResponse<Void>> revoke(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id) {
        Merchant merchant = requireMerchant(user.getId());
        MerchantTeamMember member = teamMemberRepository.findByIdAndMerchantId(id, merchant.getId())
                .orElseThrow(() -> new AppException("NOT_FOUND", "Team member not found", HttpStatus.NOT_FOUND));

        member.setStatus(MerchantTeamMember.TeamStatus.REVOKED);
        teamMemberRepository.save(member);
        log.info("Team member revoked: merchantId={}, memberId={}", merchant.getId(), id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/accept/{token}")
    @Transactional
    public ResponseEntity<ApiResponse<TeamMemberResponse>> acceptInvite(
            @PathVariable String token,
            @RequestBody Map<String, String> body) {
        MerchantTeamMember member = teamMemberRepository.findByInviteToken(token)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Invite not found or expired", HttpStatus.NOT_FOUND));

        if (member.getStatus() != MerchantTeamMember.TeamStatus.PENDING) {
            throw new AppException("INVALID_STATUS",
                    "This invite is no longer pending", HttpStatus.BAD_REQUEST);
        }

        String email = body != null ? body.get("email") : null;
        if (email == null || !email.equalsIgnoreCase(member.getEmail())) {
            throw new AppException("EMAIL_MISMATCH",
                    "Email does not match the invite", HttpStatus.BAD_REQUEST);
        }

        member.setStatus(MerchantTeamMember.TeamStatus.ACTIVE);
        member.setJoinedAt(LocalDateTime.now());
        member.setInviteToken(null);
        teamMemberRepository.save(member);

        log.info("Team member accepted invite: memberId={}", member.getId());
        return ResponseEntity.ok(ApiResponse.success(toResponse(member)));
    }

    // ==================== HELPERS ====================

    private Merchant requireMerchant(UUID userId) {
        return merchantRepository.findByUserId(userId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "No merchant account found", HttpStatus.NOT_FOUND));
    }

    private TeamMemberResponse toResponse(MerchantTeamMember m) {
        return TeamMemberResponse.builder()
                .id(m.getId().toString())
                .email(m.getEmail())
                .userId(m.getUserId() != null ? m.getUserId().toString() : null)
                .role(m.getRole().name())
                .status(m.getStatus().name())
                .invitedAt(m.getInvitedAt())
                .joinedAt(m.getJoinedAt())
                .build();
    }
}
