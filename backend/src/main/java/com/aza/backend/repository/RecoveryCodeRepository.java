package com.aza.backend.repository;

import com.aza.backend.entity.RecoveryCode;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RecoveryCodeRepository extends JpaRepository<RecoveryCode, UUID> {

    List<RecoveryCode> findAllByUserIdAndUsedFalse(UUID userId);

    void deleteAllByUserId(UUID userId);

    long countByUserIdAndUsedFalse(UUID userId);
}
