package com.aza.backend.repository;

import com.aza.backend.entity.GeneratedStatement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface GeneratedStatementRepository extends JpaRepository<GeneratedStatement, UUID> {
    Optional<GeneratedStatement> findByVerifyCode(String verifyCode);
}
