package com.aza.backend.service;

import com.aza.backend.entity.CheckoutSession;
import com.aza.backend.entity.MerchantPayout;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.CheckoutSessionRepository;
import com.aza.backend.repository.MerchantPayoutRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Double-entry journal export for the accountants. P2P transfers move customer
 * liability between wallets with no P&L effect, so they are excluded; what the
 * books need are the events that touch company revenue or external money:
 * completed merchant checkouts (fee revenue) and completed payouts (float out).
 */
@Service
@RequiredArgsConstructor
public class AccountingExportService {

    private final CheckoutSessionRepository checkoutSessionRepository;
    private final MerchantPayoutRepository payoutRepository;
    private final AdminAuditService auditService;

    private static final String ACC_CUSTOMER_FLOAT = "2100-Customer Wallet Liability";
    private static final String ACC_MERCHANT_FLOAT = "2200-Merchant Balance Liability";
    private static final String ACC_FEE_REVENUE = "4100-Platform Fee Revenue";
    private static final String ACC_SETTLEMENT_BANK = "1100-Settlement Bank";

    public String journalCsv(User admin, LocalDate from, LocalDate to) {
        if (from == null || to == null || to.isBefore(from)) {
            throw new AppException("INVALID_RANGE", "A valid from/to date range is required", HttpStatus.BAD_REQUEST);
        }
        LocalDateTime start = from.atStartOfDay();
        LocalDateTime end = to.plusDays(1).atStartOfDay();

        StringBuilder csv = new StringBuilder();
        csv.append("date,reference,description,account,debit,credit\n");

        // Merchant checkouts: customer wallet is debited; merchant is credited net;
        // the platform fee is revenue.
        for (CheckoutSession session : checkoutSessionRepository.findByStatusAndCompletedAtBetween(
                CheckoutSession.SessionStatus.COMPLETED, start, end)) {
            String date = session.getCompletedAt().toLocalDate().toString();
            String ref = "checkout-" + session.getId();
            String desc = csvSafe(session.getDescription() != null ? session.getDescription() : "Merchant checkout");
            BigDecimal gross = orZero(session.getAmount());
            BigDecimal fee = orZero(session.getPlatformFee());
            BigDecimal net = session.getNetAmount() != null ? session.getNetAmount() : gross.subtract(fee);

            line(csv, date, ref, desc, ACC_CUSTOMER_FLOAT, gross, null);
            line(csv, date, ref, desc, ACC_MERCHANT_FLOAT, null, net);
            if (fee.signum() > 0) {
                line(csv, date, ref, desc, ACC_FEE_REVENUE, null, fee);
            }
        }

        // Payouts: merchant balance leaves the platform via the settlement bank.
        for (MerchantPayout payout : payoutRepository.findByStatusAndCompletedAtBetween(
                MerchantPayout.PayoutStatus.COMPLETED, start, end)) {
            String date = payout.getCompletedAt().toLocalDate().toString();
            String ref = "payout-" + payout.getId();
            String desc = csvSafe(payout.getNote() != null ? payout.getNote() : "Merchant payout");
            line(csv, date, ref, desc, ACC_MERCHANT_FLOAT, orZero(payout.getAmount()), null);
            line(csv, date, ref, desc, ACC_SETTLEMENT_BANK, null, orZero(payout.getAmount()));
        }

        auditService.log(admin, "EXPORT_ACCOUNTING_JOURNAL", null, "from=" + from + " to=" + to);
        return csv.toString();
    }

    private static void line(StringBuilder csv, String date, String ref, String desc,
                             String account, BigDecimal debit, BigDecimal credit) {
        csv.append(date).append(',')
                .append(ref).append(',')
                .append(desc).append(',')
                .append(account).append(',')
                .append(debit != null ? debit.toPlainString() : "").append(',')
                .append(credit != null ? credit.toPlainString() : "").append('\n');
    }

    private static String csvSafe(String value) {
        return value.replace(",", " ").replace("\n", " ").replace("\r", " ");
    }

    private static BigDecimal orZero(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }
}
