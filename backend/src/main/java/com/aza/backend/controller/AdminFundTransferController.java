package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.admin.AdminFundTransferRequest;
import com.aza.backend.dto.admin.ApprovalResponse;
import com.aza.backend.entity.PendingApproval;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.service.ApprovalService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * Lets an admin move funds out of their own AZA wallet to another user. Always goes through
 * maker-checker (ApprovalService.ADMIN_FUND_TRANSFER) — a different FINANCE/ADMIN staff member
 * must approve before anything moves, so no single admin can send funds unilaterally.
 */
@RestController
@RequestMapping("/api/v1/admin/fund-transfers")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','FINANCE')")
public class AdminFundTransferController {

    private final ApprovalService approvalService;
    private final UserRepository userRepository;

    @PostMapping
    public ResponseEntity<ApiResponse<ApprovalResponse>> submit(
            @Valid @RequestBody AdminFundTransferRequest request,
            @AuthenticationPrincipal User admin) {
        String identifier = request.getRecipientIdentifier().trim();
        String handleCandidate = identifier.startsWith("@") ? identifier.substring(1) : identifier;
        User recipient = userRepository.findByEmailOrPhoneNumber(identifier, identifier)
                .or(() -> userRepository.findByUsername(handleCandidate))
                .orElseThrow(() -> new AppException("NOT_FOUND", "Recipient not found", HttpStatus.NOT_FOUND));

        if (recipient.getId().equals(admin.getId())) {
            throw new AppException("SELF_TRANSFER", "Cannot transfer to yourself", HttpStatus.BAD_REQUEST);
        }

        String recipientName = recipient.getFirstName() + " " + recipient.getLastName();
        String summary = "Transfer GHS " + request.getAmount() + " from " + admin.getEmail()
                + " to " + recipientName + " (" + identifier + "): " + request.getReference();

        return ResponseEntity.ok(ApiResponse.success(approvalService.submit(
                admin, PendingApproval.ActionType.ADMIN_FUND_TRANSFER, recipient.getId(),
                new ApprovalService.FundTransferPayload(request.getAmount(), request.getReference()),
                summary)));
    }
}
