package com.aza.backend.repository;

import com.aza.backend.entity.PaymentMandate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PaymentMandateRepository extends JpaRepository<PaymentMandate, UUID> {

    List<PaymentMandate> findAllByPayerUserIdOrderByCreatedAtDesc(UUID payerUserId);

    Page<PaymentMandate> findAllByMerchantIdOrderByCreatedAtDesc(UUID merchantId, Pageable pageable);
}
