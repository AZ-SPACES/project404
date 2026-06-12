package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.entity.WaitlistEntry;
import com.aza.backend.repository.WaitlistRepository;
import com.aza.backend.service.WaitlistService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
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

    @PostMapping("/{id}/invite")
    public ResponseEntity<ApiResponse<String>> invite(@PathVariable UUID id) {
        waitlistService.invite(id);
        return ResponseEntity.ok(ApiResponse.success("Invitation sent"));
    }
}
