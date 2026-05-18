package com.aza.backend.service;

import com.aza.backend.dto.admin.PlatformReportResponse;
import com.aza.backend.entity.Transaction;
import com.aza.backend.entity.User;
import com.aza.backend.repository.TransactionRepository;
import com.aza.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;

    public PlatformReportResponse getReport(String period) {
        LocalDateTime[] range = getDateRange(period);
        LocalDateTime start = range[0];
        LocalDateTime end = range[1];

        long txCount = transactionRepository.countByInitiatedAtBetween(start, end);
        BigDecimal txVolume = transactionRepository.sumVolumeByInitiatedAtBetween(start, end);
        if (txVolume == null) txVolume = BigDecimal.ZERO;

        long activeUsers = userRepository.countByStatus(User.AccountStatus.ACTIVE);

        BigDecimal avgTx = txCount > 0
                ? txVolume.divide(BigDecimal.valueOf(txCount), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        return PlatformReportResponse.builder()
                .period(period)
                .startDate(start.toLocalDate().toString())
                .endDate(end.toLocalDate().toString())
                .totalRevenue(BigDecimal.ZERO)       // fee revenue once fee tracking added
                .feeRevenue(BigDecimal.ZERO)
                .transactionVolume(txVolume)
                .transactionCount(txCount)
                .newUsers(0)                          // user creation timestamps needed
                .activeUsers(activeUsers)
                .kycVerifications(userRepository.countByKycStatus(User.KycStatus.VERIFIED))
                .averageTransactionSize(avgTx)
                .topTransactionType(Transaction.TransactionType.TRANSFER.name())
                .build();
    }

    private LocalDateTime[] getDateRange(String period) {
        LocalDate today = LocalDate.now();
        return switch (period.toUpperCase()) {
            case "TODAY" -> new LocalDateTime[]{today.atStartOfDay(), today.plusDays(1).atStartOfDay()};
            case "WEEK" -> new LocalDateTime[]{today.minusWeeks(1).atStartOfDay(), today.plusDays(1).atStartOfDay()};
            case "QUARTER" -> new LocalDateTime[]{today.minusMonths(3).atStartOfDay(), today.plusDays(1).atStartOfDay()};
            case "YEAR" -> new LocalDateTime[]{today.minusYears(1).atStartOfDay(), today.plusDays(1).atStartOfDay()};
            default -> new LocalDateTime[]{today.withDayOfMonth(1).atStartOfDay(), today.plusDays(1).atStartOfDay()};
        };
    }
}
