package com.aza.backend.controller;

import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.service.StatementService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/statements")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','FINANCE','COMPLIANCE')")
public class AdminStatementController {

    private final StatementService statementService;
    private final UserRepository userRepository;

    @GetMapping("/{userId}/pdf")
    public ResponseEntity<byte[]> downloadPdf(
            @PathVariable UUID userId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException("User not found"));

        byte[] pdf = statementService.generateStatementPdf(user,
                from.atStartOfDay(), to.atTime(23, 59, 59));

        String filename = "statement-" + user.getUsername() + "-"
                + from.format(DateTimeFormatter.BASIC_ISO_DATE) + "-"
                + to.format(DateTimeFormatter.BASIC_ISO_DATE) + ".pdf";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    @GetMapping("/{userId}/csv")
    public ResponseEntity<byte[]> downloadCsv(
            @PathVariable UUID userId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException("User not found"));

        byte[] csv = statementService.generateStatementCsv(user,
                from.atStartOfDay(), to.atTime(23, 59, 59));

        String filename = "statement-" + user.getUsername() + "-"
                + from.format(DateTimeFormatter.BASIC_ISO_DATE) + "-"
                + to.format(DateTimeFormatter.BASIC_ISO_DATE) + ".csv";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csv);
    }
}
