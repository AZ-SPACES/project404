package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.entity.RegulatoryFiling;
import com.aza.backend.entity.User;
import com.aza.backend.repository.RegulatoryFilingRepository;
import com.aza.backend.service.RegulatoryService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

/** Document downloads (XML/CSV), not ApiResponse JSON like the other admin endpoints. */
@RestController
@RequestMapping("/api/v1/admin/regulatory")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','COMPLIANCE','FINANCE')")
public class AdminRegulatoryController {

    private final RegulatoryService regulatoryService;
    private final RegulatoryFilingRepository filingRepository;

    @GetMapping(value = "/str/{flaggedId}", produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> strExport(
            @PathVariable UUID flaggedId,
            @AuthenticationPrincipal User admin) {
        String xml = regulatoryService.generateStrXml(admin, flaggedId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"str-" + flaggedId + ".xml\"")
                .body(xml);
    }

    @GetMapping(value = "/returns", produces = "text/csv")
    public ResponseEntity<String> monthlyReturns(
            @RequestParam String month,
            @AuthenticationPrincipal User admin) {
        YearMonth period = YearMonth.parse(month); // e.g. 2026-05
        String csv = regulatoryService.monthlyReturnsCsv(admin, period);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"bog-returns-" + period + ".csv\"")
                .body(csv);
    }

    // ── Filing calendar ───────────────────────────────────────────────────────

    @GetMapping("/filings")
    public ResponseEntity<ApiResponse<List<RegulatoryFiling>>> getFilings(
            @RequestParam(required = false) String type) {
        List<RegulatoryFiling> filings = (type != null && !type.isBlank())
                ? filingRepository.findAllByTypeOrderByFiledAtDesc(RegulatoryFiling.FilingType.valueOf(type.toUpperCase()))
                : filingRepository.findAllByOrderByFiledAtDesc();
        return ResponseEntity.ok(ApiResponse.success(filings));
    }

    @PostMapping("/filings")
    public ResponseEntity<ApiResponse<RegulatoryFiling>> markFiled(
            @RequestBody MarkFiledRequest request,
            @AuthenticationPrincipal User admin) {
        RegulatoryFiling filing = RegulatoryFiling.builder()
                .type(RegulatoryFiling.FilingType.valueOf(request.getType().toUpperCase()))
                .period(request.getPeriod())
                .notes(request.getNotes())
                .filedByEmail(admin.getEmail())
                .build();
        return ResponseEntity.ok(ApiResponse.success(filingRepository.save(filing)));
    }

    @Data
    static class MarkFiledRequest {
        private String type;   // BOG_MONTHLY_RETURNS | STR_BATCH | ACCOUNTING_JOURNAL
        private String period; // e.g. "2026-05"
        private String notes;
    }
}
