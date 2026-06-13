package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.entity.RecurringTransfer;
import com.aza.backend.entity.User;
import com.aza.backend.repository.RecurringTransferRepository;
import com.aza.backend.service.AdminAuditService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/recurring-transfers")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','FINANCE','COMPLIANCE','SUPPORT')")
public class AdminRecurringTransferController {

    private final RecurringTransferRepository recurringRepo;
    private final AdminAuditService auditService;

    @GetMapping
    public ResponseEntity<ApiResponse<Page<RecurringTransfer>>> list(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageRequest pr = PageRequest.of(page, Math.min(size, 50),
                Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<RecurringTransfer> result = status != null && !status.isBlank()
                ? recurringRepo.findAllByStatus(RecurringTransfer.Status.valueOf(status.toUpperCase()), pr)
                : recurringRepo.findAll(pr);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<ApiResponse<java.util.List<RecurringTransfer>>> byUser(
            @PathVariable UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(
                recurringRepo.findAllByUserIdOrderByCreatedAtDesc(userId)));
    }

    @PreAuthorize("hasAnyRole('ADMIN','COMPLIANCE')")
    @PatchMapping("/{id}/cancel")
    public ResponseEntity<ApiResponse<RecurringTransfer>> cancel(
            @PathVariable UUID id,
            @AuthenticationPrincipal User admin) {
        RecurringTransfer rt = recurringRepo.findById(id)
                .orElseThrow(() -> new com.aza.backend.exception.AppException("Recurring transfer not found"));
        rt.setStatus(RecurringTransfer.Status.CANCELLED);
        recurringRepo.save(rt);
        auditService.log(admin, "CANCEL_RECURRING_TRANSFER", null, "id=" + id);
        return ResponseEntity.ok(ApiResponse.success(rt));
    }
}
