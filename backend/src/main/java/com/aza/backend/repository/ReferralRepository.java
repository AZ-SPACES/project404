package com.aza.backend.repository;

import com.aza.backend.entity.Referral;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ReferralRepository extends JpaRepository<Referral, UUID> {

    List<Referral> findAllByReferrerIdOrderByCreatedAtDesc(UUID referrerId);

    Optional<Referral> findByReferredUserId(UUID referredUserId);

    boolean existsByReferredUserId(UUID referredUserId);

    long countByReferrerId(UUID referrerId);

    long countByReferrerIdAndStatus(UUID referrerId, Referral.Status status);

    Page<Referral> findAllByOrderByCreatedAtDesc(Pageable pageable);

    @Query("SELECT COUNT(r) FROM Referral r WHERE r.status = 'REWARDED'")
    long countRewarded();

    @Query("SELECT COALESCE(SUM(r.rewardAmount), 0) FROM Referral r WHERE r.status = 'REWARDED'")
    java.math.BigDecimal totalRewardsGiven();
}
