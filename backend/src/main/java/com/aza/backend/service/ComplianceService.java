package com.aza.backend.service;

import com.aza.backend.dto.admin.ComplianceStatsResponse;
import com.aza.backend.dto.admin.FlaggedTransactionResponse;
import com.aza.backend.entity.FlaggedTransaction;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.FlaggedTransactionRepository;
import com.aza.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ComplianceService {

    private final FlaggedTransactionRepository flaggedRepository;
    private final UserRepository userRepository;

    public Page<FlaggedTransactionResponse> getFlaggedTransactions(int page, int size, String status) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by("flaggedAt").descending());
        Page<FlaggedTransaction> items;
        if (status != null && !status.isBlank()) {
            FlaggedTransaction.FlagStatus flagStatus = FlaggedTransaction.FlagStatus.valueOf(status.toUpperCase());
            items = flaggedRepository.findAllByStatusOrderByFlaggedAtDesc(flagStatus, pageable);
        } else {
            items = flaggedRepository.findAllByOrderByFlaggedAtDesc(pageable);
        }
        return items.map(this::toResponse);
    }

    public ComplianceStatsResponse getStats() {
        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();

        long flaggedToday = flaggedRepository.countByFlaggedAtAfter(startOfDay);
        long pendingReview = flaggedRepository.countByStatus(FlaggedTransaction.FlagStatus.PENDING_REVIEW);
        long clearedThisMonth = flaggedRepository.countByStatus(FlaggedTransaction.FlagStatus.CLEARED);
        long reportsFiledThisMonth = flaggedRepository.countByStatus(FlaggedTransaction.FlagStatus.REPORTED);
        long highRiskUsers = flaggedRepository.countByRiskScoreGreaterThanEqual(75);
        Double avgScore = flaggedRepository.avgRiskScore();

        return ComplianceStatsResponse.builder()
                .flaggedToday(flaggedToday)
                .pendingReview(pendingReview)
                .clearedThisMonth(clearedThisMonth)
                .reportsFiledThisMonth(reportsFiledThisMonth)
                .highRiskUsers(highRiskUsers)
                .averageRiskScore(avgScore != null ? Math.round(avgScore * 10.0) / 10.0 : 0.0)
                .build();
    }

    @Transactional
    public FlaggedTransactionResponse review(UUID id, String action, String notes, User reviewer) {
        FlaggedTransaction ft = flaggedRepository.findById(id)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Flagged transaction not found", HttpStatus.NOT_FOUND));

        if (ft.getStatus() != FlaggedTransaction.FlagStatus.PENDING_REVIEW) {
            throw new AppException("INVALID_STATE", "Transaction has already been reviewed", HttpStatus.BAD_REQUEST);
        }

        FlaggedTransaction.FlagStatus newStatus = "CLEAR".equalsIgnoreCase(action)
                ? FlaggedTransaction.FlagStatus.CLEARED
                : FlaggedTransaction.FlagStatus.REPORTED;

        ft.setStatus(newStatus);
        ft.setReviewedAt(LocalDateTime.now());
        ft.setReviewedBy(reviewer.getId());
        ft.setNotes(notes);
        flaggedRepository.save(ft);

        return toResponse(ft);
    }

    public List<FlaggedTransactionResponse> getAllFlaggedForExport(String status, String from, String to) {
        FlaggedTransaction.FlagStatus flagStatus = (status != null && !status.isBlank())
                ? FlaggedTransaction.FlagStatus.valueOf(status.toUpperCase()) : null;
        LocalDateTime fromDt = (from != null && !from.isBlank()) ? LocalDate.parse(from).atStartOfDay() : null;
        LocalDateTime toDt = (to != null && !to.isBlank()) ? LocalDate.parse(to).atTime(23, 59, 59) : null;
        return flaggedRepository.exportSearch(flagStatus, fromDt, toDt).stream().map(this::toResponse).toList();
    }

    private FlaggedTransactionResponse toResponse(FlaggedTransaction ft) {
        User user = userRepository.findById(ft.getUserId()).orElse(null);
        User reviewer = ft.getReviewedBy() != null ? userRepository.findById(ft.getReviewedBy()).orElse(null) : null;
        return FlaggedTransactionResponse.builder()
                .id(ft.getId().toString())
                .transactionId(ft.getTransactionId().toString())
                .userId(ft.getUserId().toString())
                .userName(user != null ? user.getFirstName() + " " + user.getLastName() : "Unknown")
                .userHandle(user != null ? user.getUsername() : null)
                .amount(ft.getAmount())
                .currency(ft.getCurrency())
                .flagReason(ft.getFlagReason())
                .riskScore(ft.getRiskScore())
                .status(ft.getStatus().name())
                .flaggedAt(ft.getFlaggedAt())
                .reviewedAt(ft.getReviewedAt())
                .reviewedBy(reviewer != null ? reviewer.getFirstName() + " " + reviewer.getLastName() : null)
                .notes(ft.getNotes())
                .build();
    }
}
