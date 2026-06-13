package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/analytics/fees")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','FINANCE')")
public class AdminFeeAnalyticsController {

    private final TransactionRepository transactionRepository;

    @GetMapping("/summary")
    public ResponseEntity<ApiResponse<Map<String, Object>>> summary() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime startOfToday = now.toLocalDate().atStartOfDay();
        LocalDateTime startOfWeek = now.minusDays(6).toLocalDate().atStartOfDay();
        LocalDateTime startOfMonth = now.toLocalDate().withDayOfMonth(1).atStartOfDay();

        BigDecimal today = transactionRepository.sumFeesAfter(startOfToday);
        BigDecimal thisWeek = transactionRepository.sumFeesAfter(startOfWeek);
        BigDecimal thisMonth = transactionRepository.sumFeesAfter(startOfMonth);
        BigDecimal allTime = transactionRepository.sumFeesAfter(LocalDateTime.of(2000, 1, 1, 0, 0));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("today", today);
        result.put("thisWeek", thisWeek);
        result.put("thisMonth", thisMonth);
        result.put("allTime", allTime);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/daily")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> daily(
            @RequestParam(defaultValue = "30") int days) {
        int effectiveDays = Math.min(days, 90);
        LocalDateTime since = LocalDateTime.now().minusDays(effectiveDays).toLocalDate().atStartOfDay();

        List<Object[]> rows = transactionRepository.dailyFeeRevenue(since);
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object[] row : rows) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("date", row[0] != null ? row[0].toString() : null);
            m.put("fees", row[1]);
            m.put("txCount", row[2]);
            result.add(m);
        }
        return ResponseEntity.ok(ApiResponse.success(result));
    }
}
