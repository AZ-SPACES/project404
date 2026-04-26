package com.aza.backend.repository;

import com.aza.backend.entity.KycRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface KycRecordRepository extends JpaRepository<KycRecord, UUID> {

    Optional<KycRecord> findByUserId(UUID userId);

}
