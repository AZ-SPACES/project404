package com.aza.backend.service.biller;

import com.aza.backend.entity.BillPayment;
import com.aza.backend.entity.Biller;
import com.aza.backend.exception.AppException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;

/**
 * What Aza uses until a real aggregator is wired: a provider that refuses to pay.
 *
 * It exists so the rest of bill payments — the catalogue, the limits, the passcode, the
 * ledger, the reconciliation sweep — can be built, tested, and reviewed before a
 * commercial decision is made about who settles the money.
 *
 * Registered by {@link BillerProviderConfig} only when nothing else provides a
 * {@link BillerProvider}, so wiring a real aggregator replaces it without touching any of
 * the code that uses it.
 *
 * It deliberately fails closed. A stub that pretended to succeed would debit a customer's
 * wallet and tell them their electricity was paid, and the only thing standing between
 * that and production would be someone remembering to swap it out. Refusing before the
 * wallet is touched is the only safe behaviour for a provider that cannot actually pay.
 */
@Slf4j
public class UnconfiguredBillerProvider implements BillerProvider {

    @Override
    public String name() {
        return "unconfigured";
    }

    @Override
    public AccountLookup lookup(Biller biller, String accountNumber) {
        // Not an error: the app asks for a name, and "we cannot check" is a true answer.
        return AccountLookup.unsupported();
    }

    @Override
    public PaymentResult pay(BillPayment payment, Biller biller) {
        log.error("Bill payment attempted with no provider configured: biller={}, payment={}",
                biller.getSlug(), payment.getId());
        throw new AppException("BILLER_UNAVAILABLE",
                "Bill payments aren't available yet.", HttpStatus.SERVICE_UNAVAILABLE);
    }

    @Override
    public PaymentResult status(String providerReference) {
        // Nothing was ever sent, so nothing can be pending against this provider.
        return PaymentResult.rejected(providerReference, "No provider configured");
    }
}
