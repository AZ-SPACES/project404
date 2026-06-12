package com.aza.backend.controller;

import com.aza.backend.entity.User;
import com.aza.backend.service.AccountingExportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/v1/admin/accounting")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','FINANCE')")
public class AdminAccountingController {

    private final AccountingExportService accountingExportService;

    @GetMapping(value = "/journal", produces = "text/csv")
    public ResponseEntity<String> journal(
            @RequestParam String from,
            @RequestParam String to,
            @AuthenticationPrincipal User admin) {
        LocalDate fromDate = LocalDate.parse(from);
        LocalDate toDate = LocalDate.parse(to);
        String csv = accountingExportService.journalCsv(admin, fromDate, toDate);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"journal-" + from + "-to-" + to + ".csv\"")
                .body(csv);
    }
}
