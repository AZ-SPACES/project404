package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.entity.AccountClosureRequest;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.AccountClosureRequestRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.repository.WalletRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/closure-requests")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','COMPLIANCE')")
public class AdminClosureController {

    private final AccountClosureRequestRepository closureRepository;
    private final UserRepository userRepository;
    private final WalletRepository walletRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<Page<AccountClosureRequest>>> list(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<AccountClosureRequest> result = status != null
                ? closureRepository.findByStatusOrderByRequestedAtDesc(
                        AccountClosureRequest.Status.valueOf(status.toUpperCase()),
                        PageRequest.of(page, Math.min(size, 50)))
                : closureRepository.findAllByOrderByRequestedAtDesc(
                        PageRequest.of(page, Math.min(size, 50)));
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<Map<String, Long>>> stats() {
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "pending", closureRepository.countByStatus(AccountClosureRequest.Status.PENDING),
                "approved", closureRepository.countByStatus(AccountClosureRequest.Status.APPROVED),
                "rejected", closureRepository.countByStatus(AccountClosureRequest.Status.REJECTED)
        )));
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<ApiResponse<AccountClosureRequest>> approve(
            @PathVariable UUID id,
            @RequestBody(required = false) ProcessRequest request,
            @AuthenticationPrincipal User admin) {
        AccountClosureRequest req = closureRepository.findById(id)
                .orElseThrow(() -> new AppException("CLOSURE_NOT_FOUND", "Request not found", HttpStatus.NOT_FOUND));
        if (req.getStatus() != AccountClosureRequest.Status.PENDING) {
            throw new AppException("CLOSURE_ALREADY_PROCESSED", "Request already processed", HttpStatus.CONFLICT);
        }

        walletRepository.findByUserId(req.getUserId()).ifPresent(wallet -> {
            if (wallet.getBalance().compareTo(BigDecimal.ZERO) > 0) {
                throw new AppException("WALLET_NOT_EMPTY",
                        "User still has funds — withdraw before closing", HttpStatus.CONFLICT);
            }
        });

        userRepository.findById(req.getUserId()).ifPresent(user -> {
            user.setStatus(User.AccountStatus.PENDING_DELETION);
            userRepository.save(user);
        });

        req.setStatus(AccountClosureRequest.Status.APPROVED);
        req.setProcessedBy(admin.getEmail());
        req.setProcessedAt(LocalDateTime.now());
        if (request != null) req.setNotes(request.getNotes());
        return ResponseEntity.ok(ApiResponse.success(closureRepository.save(req)));
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<ApiResponse<AccountClosureRequest>> reject(
            @PathVariable UUID id,
            @RequestBody ProcessRequest request,
            @AuthenticationPrincipal User admin) {
        AccountClosureRequest req = closureRepository.findById(id)
                .orElseThrow(() -> new AppException("CLOSURE_NOT_FOUND", "Request not found", HttpStatus.NOT_FOUND));
        if (req.getStatus() != AccountClosureRequest.Status.PENDING) {
            throw new AppException("CLOSURE_ALREADY_PROCESSED", "Request already processed", HttpStatus.CONFLICT);
        }
        req.setStatus(AccountClosureRequest.Status.REJECTED);
        req.setProcessedBy(admin.getEmail());
        req.setProcessedAt(LocalDateTime.now());
        req.setNotes(request.getNotes());
        return ResponseEntity.ok(ApiResponse.success(closureRepository.save(req)));
    }

    @Data
    static class ProcessRequest {
        private String notes;
    }
}
