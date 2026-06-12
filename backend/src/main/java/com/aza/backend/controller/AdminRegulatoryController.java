package com.aza.backend.controller;

import com.aza.backend.entity.User;
import com.aza.backend.service.RegulatoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.YearMonth;
import java.util.UUID;

/** Document downloads (XML/CSV), not ApiResponse JSON like the other admin endpoints. */
@RestController
@RequestMapping("/api/v1/admin/regulatory")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','COMPLIANCE')")
public class AdminRegulatoryController {

    private final RegulatoryService regulatoryService;

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
}
