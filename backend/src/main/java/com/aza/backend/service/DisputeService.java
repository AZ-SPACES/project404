package com.aza.backend.service;

import com.aza.backend.dto.admin.DisputeResponse;
import com.aza.backend.dto.admin.DisputeStatsResponse;
import com.aza.backend.entity.Dispute;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.DisputeRepository;
import com.aza.backend.repository.MerchantNotificationPreferenceRepository;
import com.aza.backend.repository.MerchantRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.repository.TransactionRepository;
import com.aza.backend.entity.Transaction;
import com.aza.backend.util.EmailService;
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
    private final TransactionRepository transactionRepository;
    private final AdminService adminService;
    private final MerchantRepository merchantRepository;
    private final MerchantNotificationPreferenceRepository notificationPrefRepository;
    private final EmailService emailService;
    private final NotificationService notificationService;

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

        if (newStatus == Dispute.DisputeStatus.RESOLVED_APPROVED) {
            adminService.reverseTransaction(dispute.getTransactionId(), admin);
        }

        dispute.setStatus(newStatus);
        dispute.setResolution(resolution);
        dispute.setResolvedBy(admin.getId());
        dispute.setResolvedAt(LocalDateTime.now());
        disputeRepository.save(dispute);

        boolean isApproved = newStatus == Dispute.DisputeStatus.RESOLVED_APPROVED;
        userRepository.findById(dispute.getUserId()).ifPresent(filer ->
                emailService.sendDisputeResolvedEmail(
                        filer.getEmail(), filer.getFirstName(),
                        isApproved, dispute.getAmount(), dispute.getReferenceId()));

        return toResponse(dispute);
    }

    @Transactional
    public DisputeResponse createDispute(UUID transactionId, String category, String description, User user) {
        Transaction tx = transactionRepository.findById(transactionId)
                .orElseThrow(() -> new AppException("TRANSACTION_NOT_FOUND", "Transaction not found", HttpStatus.NOT_FOUND));

        if (!tx.getSenderId().equals(user.getId()) && !tx.getRecipientId().equals(user.getId())) {
            throw new AppException("UNAUTHORIZED", "You are not a participant in this transaction", HttpStatus.FORBIDDEN);
        }

        if (tx.getStatus() != Transaction.TransactionStatus.COMPLETED) {
            throw new AppException("INVALID_TRANSACTION_STATUS", "Only completed transactions can be disputed", HttpStatus.BAD_REQUEST);
        }

        if (disputeRepository.existsByTransactionId(transactionId)) {
            throw new AppException("DISPUTE_EXISTS", "A reversal request already exists for this transaction", HttpStatus.BAD_REQUEST);
        }

        Dispute.DisputeCategory dc;
        try {
            dc = Dispute.DisputeCategory.valueOf(category.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new AppException("INVALID_CATEGORY", "Invalid dispute category", HttpStatus.BAD_REQUEST);
        }

        String referenceId = "DISP-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        Dispute dispute = Dispute.builder()
                .referenceId(referenceId)
                .transactionId(transactionId)
                .userId(user.getId())
                .amount(tx.getAmount())
                .currency("GHS")
                .category(dc)
                .description(description)
                .status(Dispute.DisputeStatus.OPEN)
                .build();

        disputeRepository.save(dispute);

        merchantRepository.findByUserId(tx.getRecipientId()).ifPresent(merchant -> {
            boolean sendEmail = notificationPrefRepository.findByMerchantId(merchant.getId())
                    .map(com.aza.backend.entity.MerchantNotificationPreference::isEmailDisputeOpened)
                    .orElse(true);
            if (sendEmail) {
                userRepository.findById(merchant.getUserId()).ifPresent(owner ->
                        emailService.sendDisputeOpenedMerchantEmail(
                                owner.getEmail(), owner.getFirstName(),
                                merchant.getBusinessName(), dispute.getAmount(),
                                referenceId, dc.name()));
            }
            notificationService.sendNotification(merchant.getUserId(),
                    com.aza.backend.entity.Notification.NotificationType.SECURITY_ALERT,
                    "Dispute Opened",
                    "A customer opened a dispute for GHS " + dispute.getAmount() + " (" + referenceId + ")",
                    null);
        });

        return toResponse(dispute);
    }

    public Page<DisputeResponse> getUserDisputes(UUID userId, int page, int size) {
        PageRequest pageable = PageRequest.of(page, size);
        return disputeRepository.findAllByUserIdOrderByCreatedAtDesc(userId, pageable)
                .map(this::toResponse);
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
