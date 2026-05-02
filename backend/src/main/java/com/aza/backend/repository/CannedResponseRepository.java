package com.aza.backend.repository;

import com.aza.backend.entity.CannedResponse;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CannedResponseRepository extends JpaRepository<CannedResponse, UUID> {
    List<CannedResponse> findAllByOrderByUsageCountDescTitleAsc();
    List<CannedResponse> findByCategoryIgnoreCaseOrderByUsageCountDesc(String category);
}
