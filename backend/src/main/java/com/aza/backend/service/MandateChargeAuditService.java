package com.aza.backend.service;

import com.aza.backend.entity.MandateCharge;
import com.aza.backend.repository.MandateChargeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Records a failed mandate-charge attempt in its own transaction. Split into a separate bean
 * (not a method on PaymentMandateService) so REQUIRES_NEW actually applies — Spring's
 * proxy-based @Transactional is bypassed on self-invocation within the same bean, and this
 * record must survive independently of the charge transaction it's reporting on, which by
 * definition has already rolled back by the time this runs.
 */
@Service
@RequiredArgsConstructor
public class MandateChargeAuditService {

    private final MandateChargeRepository chargeRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordFailure(UUID mandateId, UUID merchantId, BigDecimal amount,
                               String idempotencyKey, String failureReason) {
        // A concurrent retry with the same key may have already recorded this — the unique
        // constraint on (merchantId, idempotencyKey) makes a duplicate insert here harmless
        // to ignore rather than something to surface as a new error.
        if (chargeRepository.findByMerchantIdAndIdempotencyKey(merchantId, idempotencyKey).isPresent()) {
            return;
        }
        chargeRepository.save(MandateCharge.builder()
                .mandateId(mandateId)
                .merchantId(merchantId)
                .amount(amount)
                .idempotencyKey(idempotencyKey)
                .status(MandateCharge.Status.FAILED)
                .failureReason(failureReason)
                .build());
    }
}
