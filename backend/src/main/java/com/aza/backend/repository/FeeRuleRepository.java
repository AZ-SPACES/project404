package com.aza.backend.repository;

import com.aza.backend.entity.FeeRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface FeeRuleRepository extends JpaRepository<FeeRule, UUID> {
    List<FeeRule> findAllByOrderByTransactionTypeAscEffectiveFromAsc();
    long countByActiveTrue();
}
