package com.aza.backend.scheduler;

import com.aza.backend.service.BillPaymentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Finds out what happened to bills whose provider never answered.
 *
 * The money for these has already left the customer's wallet, so leaving them unresolved
 * is not a tidy-up job — it is customer money in limbo. The sweep asks the provider what
 * became of each one; it never infers failure from silence, because refunding a payment
 * the biller actually took would pay the bill twice.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class BillPaymentReconcileScheduler {

    private final BillPaymentService billPaymentService;

    @Scheduled(fixedDelay = 120_000)
    public void sweep() {
        try {
            billPaymentService.reconcile();
        } catch (Exception e) {
            log.error("Bill payment reconciliation sweep failed", e);
        }
    }
}
