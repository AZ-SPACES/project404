package com.aza.backend.repository;

import com.aza.backend.entity.StaffRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface StaffRoleRepository extends JpaRepository<StaffRole, UUID> {

    List<StaffRole> findByUserIdAndRevokedAtIsNull(UUID userId);

    List<StaffRole> findByRevokedAtIsNull();

    Optional<StaffRole> findFirstByUserIdAndRoleAndRevokedAtIsNull(UUID userId, StaffRole.Role role);

    long countByRoleAndRevokedAtIsNull(StaffRole.Role role);

    List<StaffRole> findByUserIdOrderByGrantedAtDesc(UUID userId);
}
