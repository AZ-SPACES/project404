package com.aza.backend.repository;

import com.aza.backend.entity.UserWithdrawal;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface UserWithdrawalRepository extends JpaRepository<UserWithdrawal, UUID> {
    Page<UserWithdrawal> findAllByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);
    Page<UserWithdrawal> findAllByStatusOrderByCreatedAtDesc(UserWithdrawal.WithdrawalStatus status, Pageable pageable);
    Page<UserWithdrawal> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
