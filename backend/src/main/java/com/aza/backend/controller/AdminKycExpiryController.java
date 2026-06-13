package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.entity.KycRecord;
import com.aza.backend.repository.KycRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/admin/kyc/expiring")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','COMPLIANCE')")
public class AdminKycExpiryController {

    private final KycRecordRepository kycRecordRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> expiringDocuments(
            @RequestParam(defaultValue = "30") int days) {
        int effectiveDays = Math.min(days, 90);
        LocalDate now = LocalDate.now();
        LocalDate cutoff = now.plusDays(effectiveDays);

        List<Map<String, Object>> result = kycRecordRepository
                .findByIdExpiryDateBetweenOrderByIdExpiryDateAsc(now, cutoff)
                .stream()
                .map(this::toMap)
                .collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<Map<String, Object>>> stats() {
        LocalDate now = LocalDate.now();

        long in7Days = kycRecordRepository
                .findByIdExpiryDateBetweenOrderByIdExpiryDateAsc(now, now.plusDays(7))
                .size();

        long in30Days = kycRecordRepository
                .findByIdExpiryDateBetweenOrderByIdExpiryDateAsc(now, now.plusDays(30))
                .size();

        long alreadyExpired = kycRecordRepository
                .findByIdExpiryDateBeforeAndStatusNot(now, KycRecord.KycStatus.REJECTED)
                .size();

        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "expiringIn7Days", in7Days,
                "expiringIn30Days", in30Days,
                "alreadyExpired", alreadyExpired
        )));
    }

    private Map<String, Object> toMap(KycRecord k) {
        java.util.LinkedHashMap<String, Object> m = new java.util.LinkedHashMap<>();
        m.put("id", k.getId());
        m.put("userId", k.getUserId());
        m.put("idType", k.getIdType() != null ? k.getIdType().name() : null);
        m.put("idNumber", k.getIdNumber());
        m.put("idExpiryDate", k.getIdExpiryDate());
        m.put("status", k.getStatus() != null ? k.getStatus().name() : null);
        m.put("submittedAt", k.getSubmittedAt());
        return m;
    }
}
