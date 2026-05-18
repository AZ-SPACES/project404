package com.aza.backend.service;

import com.aza.backend.dto.admin.DisputeResponse;
import com.aza.backend.dto.admin.DisputeStatsResponse;
import com.aza.backend.entity.Dispute;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.DisputeRepository;
import com.aza.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DisputeService {

    private final DisputeRepository disputeRepository;
    private final UserRepository userRepository;

    public Page<DisputeResponse> getDisputes(int page, int size, String status) {
        PageRequest pageable = PageRequest.of(page, size);
        Page<Dispute> items;
        if (status != null && !status.isBlank()) {
            Dispute.DisputeStatus ds = Dispute.DisputeStatus.valueOf(status.toUpperCase());
            items = disputeRepository.findAllByStatusOrderByCreatedAtDesc(ds, pageable);
        } else {
            items = disputeRepository.findAllByOrderByCreatedAtDesc(pageable);
        }
        return items.map(this::toResponse);
    }

    public DisputeStatsResponse getStats() {
        long open = disputeRepository.countByStatus(Dispute.DisputeStatus.OPEN);
        long underReview = disputeRepository.countByStatus(Dispute.DisputeStatus.UNDER_REVIEW);
        LocalDateTime startOfMonth = LocalDate.now().withDayOfMonth(1).atStartOfDay();
        long resolvedThisMonth = disputeRepository.countByResolvedAtAfter(startOfMonth);
        BigDecimal totalValue = disputeRepository.sumActiveDisputeValue();

        return DisputeStatsResponse.builder()
                .open(open)
                .underReview(underReview)
                .resolvedThisMonth(resolvedThisMonth)
                .totalValueDisputed(totalValue != null ? totalValue : BigDecimal.ZERO)
                .build();
    }

    @Transactional
    public DisputeResponse resolve(UUID id, String action, String resolution, User admin) {
        Dispute dispute = disputeRepository.findById(id)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Dispute not found", HttpStatus.NOT_FOUND));

        if (dispute.getStatus() == Dispute.DisputeStatus.RESOLVED_APPROVED
                || dispute.getStatus() == Dispute.DisputeStatus.RESOLVED_DENIED) {
            throw new AppException("ALREADY_RESOLVED", "Dispute is already resolved", HttpStatus.BAD_REQUEST);
        }

        Dispute.DisputeStatus newStatus = "APPROVE".equalsIgnoreCase(action)
                ? Dispute.DisputeStatus.RESOLVED_APPROVED
                : Dispute.DisputeStatus.RESOLVED_DENIED;

        dispute.setStatus(newStatus);
        dispute.setResolution(resolution);
        dispute.setResolvedBy(admin.getId());
        dispute.setResolvedAt(LocalDateTime.now());
        disputeRepository.save(dispute);

        return toResponse(dispute);
    }

    private DisputeResponse toResponse(Dispute d) {
        User user = userRepository.findById(d.getUserId()).orElse(null);
        return DisputeResponse.builder()
                .id(d.getId().toString())
                .referenceId(d.getReferenceId())
                .transactionId(d.getTransactionId().toString())
                .userId(d.getUserId().toString())
                .userName(user != null ? user.getFirstName() + " " + user.getLastName() : "Unknown")
                .userHandle(user != null ? user.getUsername() : null)
                .amount(d.getAmount())
                .currency(d.getCurrency())
                .category(d.getCategory().name())
                .description(d.getDescription())
                .evidence(d.getEvidence())
                .status(d.getStatus().name())
                .resolution(d.getResolution())
                .createdAt(d.getCreatedAt())
                .resolvedAt(d.getResolvedAt())
                .build();
    }
}
