package com.aza.backend.service.biller;

import com.aza.backend.entity.BillPayment;
import com.aza.backend.entity.Biller;

/**
 * The seam between Aza and whoever actually settles with a biller.
 *
 * Everything about paying a bill is the same regardless of aggregator except three
 * questions: who owns this account, did the payment go through, and — when the answer to
 * the second was silence — what happened in the end.
 *
 * The third is not optional. A provider that times out has not told us the payment
 * failed; it has told us nothing, and the money has already left the wallet. Any
 * implementation that cannot answer {@link #status} honestly will strand customer money,
 * so returning {@link Outcome#UNKNOWN} is a legitimate answer and guessing is not.
 */
public interface BillerProvider {

    /** Identifies this provider in logs, records, and configuration. */
    String name();

    /**
     * Who does this account belong to?
     *
     * Called before any money moves, so a payer can see a name and stop themselves
     * paying into a mistyped meter number. Billers that cannot answer return
     * {@link AccountLookup#unsupported()} rather than a made-up name.
     */
    AccountLookup lookup(Biller biller, String accountNumber);

    /**
     * Pay the biller. Called only after the wallet debit has committed, so an
     * implementation may assume the money is already Aza's to send.
     */
    PaymentResult pay(BillPayment payment, Biller biller);

    /**
     * What became of a payment whose result was never seen.
     *
     * The reconciliation sweep asks this rather than assuming a timeout means failure —
     * refunding a payment the biller actually took would pay it twice.
     */
    PaymentResult status(String providerReference);

    enum Outcome {
        /** The biller has the money. */
        SUCCESS,
        /** The provider refused it and is not holding the money. Safe to refund. */
        REJECTED,
        /** No definite answer. Leave it pending and ask again; never refund on this. */
        UNKNOWN
    }

    /**
     * @param outcome           what happened, as far as the provider will commit to
     * @param providerReference the provider's id for this payment, for tracing disputes
     * @param token             what the biller handed back — a meter token, a receipt
     * @param failureReason     why, when the outcome was not success
     */
    record PaymentResult(Outcome outcome, String providerReference, String token, String failureReason) {

        public static PaymentResult success(String reference, String token) {
            return new PaymentResult(Outcome.SUCCESS, reference, token, null);
        }

        public static PaymentResult rejected(String reference, String reason) {
            return new PaymentResult(Outcome.REJECTED, reference, null, reason);
        }

        public static PaymentResult unknown(String reference) {
            return new PaymentResult(Outcome.UNKNOWN, reference, null, null);
        }
    }

    /**
     * @param supported whether this biller can resolve names at all
     * @param found     whether the account exists
     * @param name      the account holder, when found
     */
    record AccountLookup(boolean supported, boolean found, String name) {

        public static AccountLookup unsupported() {
            return new AccountLookup(false, false, null);
        }

        public static AccountLookup found(String name) {
            return new AccountLookup(true, true, name);
        }

        public static AccountLookup notFound() {
            return new AccountLookup(true, false, null);
        }
    }
}
