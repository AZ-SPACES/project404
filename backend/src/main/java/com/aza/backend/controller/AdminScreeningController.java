package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.admin.ScreeningMatchResponse;
import com.aza.backend.entity.SanctionsListEntry;
import com.aza.backend.entity.User;
import com.aza.backend.service.ScreeningService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/screening")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','COMPLIANCE')")
public class AdminScreeningController {

    private final ScreeningService screeningService;

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<Map<String, Long>>> stats() {
        return ResponseEntity.ok(ApiResponse.success(screeningService.stats()));
    }

    @PostMapping("/run")
    public ResponseEntity<ApiResponse<Map<String, Integer>>> run() {
        return ResponseEntity.ok(ApiResponse.success(
                Map.of("newMatches", screeningService.screenAllUsers())));
    }

    // ── Matches ───────────────────────────────────────────────────────────────

    @GetMapping("/matches")
    public ResponseEntity<ApiResponse<Page<ScreeningMatchResponse>>> matches(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                screeningService.listMatches(status, page, Math.min(size, 50))));
    }

    @PostMapping("/matches/{id}/review")
    public ResponseEntity<ApiResponse<ScreeningMatchResponse>> review(
            @PathVariable UUID id,
            @RequestBody ReviewRequest request,
            @AuthenticationPrincipal User admin) {
        return ResponseEntity.ok(ApiResponse.success(
                screeningService.reviewMatch(admin, id, request.isConfirmed(), request.getNotes())));
    }

    // ── Watchlist management ──────────────────────────────────────────────────

    @GetMapping("/list")
    public ResponseEntity<ApiResponse<List<SanctionsListEntry>>> listEntries() {
        return ResponseEntity.ok(ApiResponse.success(screeningService.listEntries()));
    }

    @PostMapping("/list")
    public ResponseEntity<ApiResponse<SanctionsListEntry>> addEntry(
            @RequestBody AddEntryRequest request,
            @AuthenticationPrincipal User admin) {
        return ResponseEntity.ok(ApiResponse.success(screeningService.addEntry(
                admin, request.getListName(), request.getFullName(),
                SanctionsListEntry.EntryType.valueOf(request.getEntryType().toUpperCase()),
                request.getCountry(), request.getNotes())));
    }

    @PostMapping("/list/import")
    public ResponseEntity<ApiResponse<Map<String, Integer>>> importEntries(
            @RequestBody ImportRequest request,
            @AuthenticationPrincipal User admin) {
        return ResponseEntity.ok(ApiResponse.success(
                Map.of("imported", screeningService.importEntries(admin, request.getCsv()))));
    }

    @DeleteMapping("/list/{id}")
    public ResponseEntity<ApiResponse<String>> deactivateEntry(
            @PathVariable UUID id,
            @AuthenticationPrincipal User admin) {
        screeningService.deactivateEntry(admin, id);
        return ResponseEntity.ok(ApiResponse.success("Entry deactivated"));
    }

    @Data
    static class ReviewRequest {
        private boolean confirmed;
        private String notes;
    }

    @Data
    static class AddEntryRequest {
        private String listName;
        private String fullName;
        private String entryType;
        private String country;
        private String notes;
    }

    @Data
    static class ImportRequest {
        private String csv;
    }
}
