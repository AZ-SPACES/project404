package com.aza.backend.repository;

import com.aza.backend.entity.LimitIncreaseRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface LimitIncreaseRequestRepository extends JpaRepository<LimitIncreaseRequest, UUID> {
    Page<LimitIncreaseRequest> findByStatus(LimitIncreaseRequest.Status status, Pageable pageable);
    long countByStatus(LimitIncreaseRequest.Status status);
}
