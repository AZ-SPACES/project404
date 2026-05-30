package com.aza.backend.service;

import com.aza.backend.entity.User;
import com.aza.backend.repository.TransactionRepository;
import com.aza.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminAnalyticsService {

    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;

    private static final DateTimeFormatter MONTH_FMT = DateTimeFormatter.ofPattern("yyyy-MM");

    // ==================== TASK 4: COHORT RETENTION ====================

    public Map<String, Object> getCohortRetention(int months) {
        YearMonth current = YearMonth.now();
        List<Map<String, Object>> cohorts = new ArrayList<>();

        for (int i = months - 1; i >= 0; i--) {
            YearMonth cohortMonth = current.minusMonths(i);
            LocalDateTime cohortStart = cohortMonth.atDay(1).atStartOfDay();
            LocalDateTime cohortEnd = cohortMonth.atEndOfMonth().plusDays(1).atStartOfDay();

            List<User> signups = userRepository.findSignupsInPeriod(cohortStart, cohortEnd);
            int cohortSize = signups.size();
            List<UUID> userIds = signups.stream().map(User::getId).collect(Collectors.toList());

            // How many subsequent months are available (including month+0)
            int maxMonths = i + 1; // from cohortMonth up to current month inclusive
            List<Integer> retention = new ArrayList<>();

            for (int m = 0; m < maxMonths; m++) {
                if (cohortSize == 0) {
                    retention.add(0);
                    continue;
                }
                YearMonth checkMonth = cohortMonth.plusMonths(m);
                LocalDateTime mStart = checkMonth.atDay(1).atStartOfDay();
                LocalDateTime mEnd = checkMonth.atEndOfMonth().plusDays(1).atStartOfDay();
                List<UUID> activeIds = userIds.isEmpty()
                        ? List.of()
                        : transactionRepository.findActiveUserIds(userIds, mStart, mEnd);
                int pct = (int) Math.round((double) activeIds.size() / cohortSize * 100);
                retention.add(pct);
            }

            cohorts.add(Map.of(
                    "month", cohortMonth.format(MONTH_FMT),
                    "cohortSize", cohortSize,
                    "retention", retention));
        }

        return Map.of("cohorts", cohorts);
    }

    // ==================== TASK 5: REVENUE DASHBOARD ====================

    public Map<String, Object> getRevenueDashboard(int months) {
        YearMonth current = YearMonth.now();
        List<Map<String, Object>> monthly = new ArrayList<>();

        BigDecimal totalVolume = BigDecimal.ZERO;
        long totalCount = 0;
        LocalDateTime periodStart = null;
        LocalDateTime periodEnd = current.atEndOfMonth().plusDays(1).atStartOfDay();

        for (int i = months - 1; i >= 0; i--) {
            YearMonth month = current.minusMonths(i);
            LocalDateTime mStart = month.atDay(1).atStartOfDay();
            LocalDateTime mEnd = month.atEndOfMonth().plusDays(1).atStartOfDay();

            if (periodStart == null) periodStart = mStart;

            BigDecimal volume = transactionRepository.sumVolumeByInitiatedAtBetween(mStart, mEnd);
            long count = transactionRepository.countByInitiatedAtBetween(mStart, mEnd);
            BigDecimal avg = count > 0
                    ? volume.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;

            monthly.add(Map.of(
                    "month", month.format(MONTH_FMT),
                    "volume", volume,
                    "count", count,
                    "avgTransaction", avg));

            totalVolume = totalVolume.add(volume);
            totalCount += count;
        }

        BigDecimal totalAvg = totalCount > 0
                ? totalVolume.divide(BigDecimal.valueOf(totalCount), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        long activeUsers = periodStart != null
                ? transactionRepository.countActiveUsersBetween(periodStart, periodEnd)
                : 0L;

        return Map.of(
                "monthly", monthly,
                "totals", Map.of(
                        "volume", totalVolume,
                        "count", totalCount,
                        "avgTransaction", totalAvg,
                        "activeUsers", activeUsers));
    }
}
