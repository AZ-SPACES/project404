package com.aza.backend.repository;

import com.aza.backend.entity.MerchantTeamMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MerchantTeamMemberRepository extends JpaRepository<MerchantTeamMember, UUID> {
    List<MerchantTeamMember> findAllByMerchantIdOrderByInvitedAtDesc(UUID merchantId);
    Optional<MerchantTeamMember> findByInviteToken(String token);
    Optional<MerchantTeamMember> findByIdAndMerchantId(UUID id, UUID merchantId);
    boolean existsByMerchantIdAndEmail(UUID merchantId, String email);
}
