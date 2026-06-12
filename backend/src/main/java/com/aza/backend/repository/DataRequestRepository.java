package com.aza.backend.repository;

import com.aza.backend.entity.DataRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface DataRequestRepository extends JpaRepository<DataRequest, UUID> {

    Page<DataRequest> findByStatusOrderByDueDateAsc(DataRequest.Status status, Pageable pageable);

    Page<DataRequest> findAllByOrderByCreatedAtDesc(Pageable pageable);

    long countByStatus(DataRequest.Status status);
}
