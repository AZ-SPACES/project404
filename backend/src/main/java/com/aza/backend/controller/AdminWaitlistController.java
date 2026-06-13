package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.entity.WaitlistEntry;
import com.aza.backend.repository.WaitlistRepository;
import com.aza.backend.service.WaitlistService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/waitlist")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','SUPPORT')")
public class AdminWaitlistController {

    private final WaitlistService waitlistService;
    private final WaitlistRepository waitlistRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<List<WaitlistEntry>>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        List<WaitlistEntry> entries = waitlistRepository
                .findAllByOrderByCreatedAtDesc(PageRequest.of(page, Math.min(size, 100)));
        return ResponseEntity.ok(ApiResponse.success(entries));
    }

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<Map<String, Long>>> stats() {
        long total = waitlistRepository.count();
        long invited = waitlistRepository.countByInvitedAtIsNotNull();
        long confirmationSent = waitlistRepository.countByConfirmationSent(true);
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "total", total,
                "pending", total - invited,
                "invited", invited,
                "confirmationSent", confirmationSent
        )));
    }

    @PostMapping("/{id}/invite")
    public ResponseEntity<ApiResponse<String>> invite(@PathVariable UUID id) {
        waitlistService.invite(id);
        return ResponseEntity.ok(ApiResponse.success("Invitation sent"));
    }

    @PostMapping("/batch-invite")
    public ResponseEntity<ApiResponse<Map<String, Integer>>> batchInvite(
            @RequestBody BatchInviteRequest request) {
        int count = 0;
        for (UUID id : request.getIds()) {
            try {
                waitlistService.invite(id);
                count++;
            } catch (Exception ignored) {
            }
        }
        return ResponseEntity.ok(ApiResponse.success(Map.of("invited", count)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<String>> delete(@PathVariable UUID id) {
        waitlistRepository.deleteById(id);
        return ResponseEntity.ok(ApiResponse.success("Entry removed"));
    }

    @Data
    static class BatchInviteRequest {
        private List<UUID> ids;
    }
}
