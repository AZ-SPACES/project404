package com.aza.backend.repository;

import com.aza.backend.entity.KycRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface KycRecordRepository extends JpaRepository<KycRecord, UUID> {

    Optional<KycRecord> findByUserId(UUID userId);

    List<KycRecord> findAllByStatus(KycRecord.KycStatus status);

    long countByStatus(KycRecord.KycStatus status);

    @Query("SELECT COUNT(k) FROM KycRecord k WHERE k.status = :status AND k.verifiedAt >= :since")
    long countByStatusAndVerifiedAtAfter(@Param("status") KycRecord.KycStatus status,
                                         @Param("since") LocalDateTime since);

    @Query("SELECT COUNT(k) FROM KycRecord k WHERE k.status = :status AND k.submittedAt >= :since")
    long countByStatusAndSubmittedAtAfter(@Param("status") KycRecord.KycStatus status,
                                          @Param("since") LocalDateTime since);

    @Query("SELECT COUNT(k) FROM KycRecord k WHERE k.submittedAt >= :since")
    long countBySubmittedAtAfter(@Param("since") LocalDateTime since);

    @Query("SELECT COUNT(k) FROM KycRecord k WHERE k.status = :status AND k.submittedAt < :cutoff")
    long countByStatusAndSubmittedAtBefore(@Param("status") KycRecord.KycStatus status,
                                           @Param("cutoff") LocalDateTime cutoff);

    List<KycRecord> findByIdExpiryDateBetweenOrderByIdExpiryDateAsc(LocalDate from, LocalDate to);

    List<KycRecord> findByIdExpiryDateBeforeAndStatusNot(LocalDate date, KycRecord.KycStatus status);
}
