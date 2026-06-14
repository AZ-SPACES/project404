package com.aza.backend.repository;

import com.aza.backend.entity.WithdrawalCode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface WithdrawalCodeRepository extends JpaRepository<WithdrawalCode, UUID> {
    Optional<WithdrawalCode> findByCodeHash(String codeHash);
}
