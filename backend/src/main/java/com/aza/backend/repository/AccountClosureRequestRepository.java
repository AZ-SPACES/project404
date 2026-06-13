package com.aza.backend.repository;

import com.aza.backend.entity.AccountClosureRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AccountClosureRequestRepository extends JpaRepository<AccountClosureRequest, UUID> {

    Page<AccountClosureRequest> findAllByOrderByRequestedAtDesc(Pageable pageable);

    Page<AccountClosureRequest> findByStatusOrderByRequestedAtDesc(
            AccountClosureRequest.Status status, Pageable pageable);

    Optional<AccountClosureRequest> findByUserIdAndStatus(UUID userId, AccountClosureRequest.Status status);

    boolean existsByUserIdAndStatus(UUID userId, AccountClosureRequest.Status status);

    long countByStatus(AccountClosureRequest.Status status);
}
