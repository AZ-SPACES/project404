package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.entity.GeneratedStatement;
import com.aza.backend.repository.GeneratedStatementRepository;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@RestController
@RequestMapping("/api/v1/public/statements")
@RequiredArgsConstructor
public class StatementVerifyController {

    private final GeneratedStatementRepository statementRepository;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd MMM yyyy");

    @GetMapping("/verify")
    public ResponseEntity<ApiResponse<VerifyResponse>> verify(
            @RequestParam String code) {

        // Strip dashes in case the user types the formatted version
        String normalised = code.replace("-", "").toUpperCase();

        return statementRepository.findByVerifyCode(normalised)
                .map(s -> ResponseEntity.ok(ApiResponse.success(toResponse(s, true))))
                .orElseGet(() -> ResponseEntity.ok(ApiResponse.success(
                        VerifyResponse.builder().verified(false).build())));
    }

    private static VerifyResponse toResponse(GeneratedStatement s, boolean verified) {
        return VerifyResponse.builder()
                .verified(verified)
                .accountHolderName(s.getAccountHolderName())
                .accountNumber(s.getAccountNumber())
                .periodStart(s.getPeriodStart().format(DATE_FMT))
                .periodEnd(s.getPeriodEnd().format(DATE_FMT))
                .transactionCount(s.getTransactionCount())
                .openingBalance(s.getOpeningBalance())
                .totalCredits(s.getTotalCredits())
                .totalDebits(s.getTotalDebits())
                .closingBalance(s.getClosingBalance())
                .generatedAt(s.getGeneratedAt().format(DateTimeFormatter.ofPattern("dd MMM yyyy, HH:mm")))
                .currency("GHS")
                .issuedBy("AZA Financial Technology Ltd")
                .build();
    }

    @Data @Builder
    public static class VerifyResponse {
        private boolean     verified;
        private String      accountHolderName;
        private String      accountNumber;
        private String      periodStart;
        private String      periodEnd;
        private Integer     transactionCount;
        private BigDecimal  openingBalance;
        private BigDecimal  totalCredits;
        private BigDecimal  totalDebits;
        private BigDecimal  closingBalance;
        private String      generatedAt;
        private String      currency;
        private String      issuedBy;
    }
}
