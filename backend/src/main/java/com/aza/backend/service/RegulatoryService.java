package com.aza.backend.service;

import com.aza.backend.entity.FlaggedTransaction;
import com.aza.backend.entity.Transaction;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.UUID;

/**
 * Regulatory outputs: goAML-style STR XML for the FIC, and the monthly BoG
 * e-money return as CSV. These generate documents from existing case data —
 * status workflow (marking a flag REPORTED) stays in the compliance review flow.
 */
@Service
@RequiredArgsConstructor
public class RegulatoryService {

    private final FlaggedTransactionRepository flaggedRepository;
    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;
    private final WalletRepository walletRepository;
    private final MerchantRepository merchantRepository;
    private final DisputeRepository disputeRepository;
    private final com.aza.backend.repository.ComplaintRepository complaintRepository;
    private final AdminAuditService auditService;

    public String generateStrXml(User admin, UUID flaggedId) {
        FlaggedTransaction flag = flaggedRepository.findById(flaggedId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Flagged transaction not found", HttpStatus.NOT_FOUND));
        Transaction tx = transactionRepository.findById(flag.getTransactionId()).orElse(null);
        User subject = userRepository.findById(flag.getUserId()).orElse(null);

        StringBuilder xml = new StringBuilder();
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        xml.append("<report>\n");
        xml.append("  <rentity_id>AZA</rentity_id>\n");
        xml.append("  <submission_code>E</submission_code>\n");
        xml.append("  <report_code>STR</report_code>\n");
        xml.append("  <submission_date>").append(esc(LocalDateTime.now().toString())).append("</submission_date>\n");
        xml.append("  <currency_code_local>GHS</currency_code_local>\n");
        xml.append("  <reason>").append(esc(flag.getFlagReason())).append("</reason>\n");
        xml.append("  <transaction>\n");
        xml.append("    <transactionnumber>").append(esc(flag.getTransactionId().toString())).append("</transactionnumber>\n");
        xml.append("    <amount_local>").append(flag.getAmount()).append("</amount_local>\n");
        xml.append("    <transaction_description>")
                .append(esc(tx != null && tx.getNote() != null ? tx.getNote() : "P2P transfer"))
                .append("</transaction_description>\n");
        if (tx != null && tx.getInitiatedAt() != null) {
            xml.append("    <date_transaction>").append(esc(tx.getInitiatedAt().toString())).append("</date_transaction>\n");
        }
        xml.append("    <risk_score>").append(flag.getRiskScore()).append("</risk_score>\n");
        xml.append("  </transaction>\n");
        if (subject != null) {
            xml.append("  <subject>\n");
            xml.append("    <first_name>").append(esc(subject.getFirstName())).append("</first_name>\n");
            xml.append("    <last_name>").append(esc(subject.getLastName())).append("</last_name>\n");
            if (subject.getDateOfBirth() != null) {
                xml.append("    <birthdate>").append(esc(subject.getDateOfBirth().toString())).append("</birthdate>\n");
            }
            xml.append("    <nationality>").append(esc(subject.getNationality())).append("</nationality>\n");
            xml.append("    <email>").append(esc(subject.getEmail())).append("</email>\n");
            xml.append("    <phone>").append(esc(subject.getPhoneNumber())).append("</phone>\n");
            xml.append("    <address>").append(esc(subject.getHomeAddress())).append("</address>\n");
            xml.append("    <city>").append(esc(subject.getCity())).append("</city>\n");
            xml.append("  </subject>\n");
        }
        if (flag.getNotes() != null) {
            xml.append("  <comments>").append(esc(flag.getNotes())).append("</comments>\n");
        }
        xml.append("</report>\n");

        auditService.log(admin, "EXPORT_STR", subject, "flaggedId=" + flaggedId);
        return xml.toString();
    }

    public String monthlyReturnsCsv(User admin, YearMonth month) {
        LocalDateTime start = month.atDay(1).atStartOfDay();
        LocalDateTime end = month.plusMonths(1).atDay(1).atStartOfDay();

        long totalUsers = userRepository.count();
        long newUsers = userRepository.countByCreatedAtBetween(start, end);
        long activeAccounts = userRepository.countByStatus(User.AccountStatus.ACTIVE);
        long kycVerified = userRepository.countByKycStatus(User.KycStatus.VERIFIED);
        long txCount = transactionRepository.countByStatusAndInitiatedAtBetween(
                Transaction.TransactionStatus.COMPLETED, start, end);
        BigDecimal txVolume = orZero(transactionRepository.sumVolumeByInitiatedAtBetween(start, end));
        BigDecimal customerFloat = orZero(walletRepository.sumTotalBalance());
        BigDecimal merchantFloat = orZero(merchantRepository.sumTotalMerchantBalance());
        long disputesOpened = disputeRepository.countByCreatedAtBetween(start, end);
        long disputesResolved = disputeRepository.countByResolvedAtBetween(start, end);
        long flagged = flaggedRepository.countByFlaggedAtBetween(start, end);
        long strsFiled = flaggedRepository.countByStatusAndReviewedAtBetween(
                FlaggedTransaction.FlagStatus.REPORTED, start, end);

        StringBuilder csv = new StringBuilder();
        csv.append("metric,value\n");
        csv.append("reporting_period,").append(month).append('\n');
        csv.append("generated_at,").append(LocalDateTime.now()).append('\n');
        csv.append("total_registered_users,").append(totalUsers).append('\n');
        csv.append("new_users_in_period,").append(newUsers).append('\n');
        csv.append("active_accounts,").append(activeAccounts).append('\n');
        csv.append("kyc_verified_users,").append(kycVerified).append('\n');
        csv.append("completed_transactions_in_period,").append(txCount).append('\n');
        csv.append("transaction_volume_ghs,").append(txVolume).append('\n');
        csv.append("customer_float_ghs,").append(customerFloat).append('\n');
        csv.append("merchant_float_ghs,").append(merchantFloat).append('\n');
        csv.append("total_float_ghs,").append(customerFloat.add(merchantFloat)).append('\n');
        csv.append("disputes_opened_in_period,").append(disputesOpened).append('\n');
        csv.append("disputes_resolved_in_period,").append(disputesResolved).append('\n');
        csv.append("complaints_received_in_period,").append(complaintRepository.countByCreatedAtBetween(start, end)).append('\n');
        csv.append("complaints_resolved_in_period,").append(complaintRepository.countByResolvedAtBetween(start, end)).append('\n');
        csv.append("transactions_flagged_in_period,").append(flagged).append('\n');
        csv.append("strs_filed_in_period,").append(strsFiled).append('\n');

        auditService.log(admin, "EXPORT_REGULATORY_RETURNS", null, "period=" + month);
        return csv.toString();
    }

    private static String esc(String value) {
        if (value == null) return "";
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&apos;");
    }

    private static BigDecimal orZero(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }
}
