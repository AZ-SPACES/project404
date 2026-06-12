package com.aza.backend.service;

import com.aza.backend.dto.admin.DataRequestResponse;
import com.aza.backend.entity.DataRequest;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.DataRequestRepository;
import com.aza.backend.repository.KycRecordRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.repository.WalletRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Data-protection (DSAR) workflow. Requests get a 30-day due date; the ACCESS
 * export bundles everything held on the user. DELETION requests are tracked
 * here but executed by the existing PENDING_DELETION account flow.
 */
@Service
@RequiredArgsConstructor
public class DataRequestService {

    private final DataRequestRepository dataRequestRepository;
    private final UserRepository userRepository;
    private final WalletRepository walletRepository;
    private final KycRecordRepository kycRecordRepository;
    private final UserService userService;
    private final AdminService adminService;
    private final AdminAuditService auditService;

    private static final int RESPONSE_WINDOW_DAYS = 30;

    @Transactional
    public DataRequestResponse create(User admin, UUID userId, DataRequest.RequestType type, String notes) {
        User target = userRepository.findById(userId)
                .orElseThrow(() -> new AppException("USER_NOT_FOUND", "User not found", HttpStatus.NOT_FOUND));
        DataRequest request = dataRequestRepository.save(DataRequest.builder()
                .userId(userId)
                .type(type)
                .dueDate(LocalDate.now().plusDays(RESPONSE_WINDOW_DAYS))
                .notes(notes)
                .build());
        auditService.log(admin, "CREATE_DATA_REQUEST", target, "type=" + type + " due=" + request.getDueDate());
        return toResponse(request, target);
    }

    @Transactional
    public DataRequestResponse updateStatus(User admin, UUID requestId, DataRequest.Status status, String notes) {
        DataRequest request = dataRequestRepository.findById(requestId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Data request not found", HttpStatus.NOT_FOUND));
        request.setStatus(status);
        request.setHandledBy(admin.getId());
        if (notes != null && !notes.isBlank()) {
            request.setNotes(notes);
        }
        if (status == DataRequest.Status.COMPLETED) {
            request.setCompletedAt(LocalDateTime.now());
        }
        dataRequestRepository.save(request);
        User target = userRepository.findById(request.getUserId()).orElse(null);
        auditService.log(admin, "UPDATE_DATA_REQUEST", target, "id=" + requestId + " status=" + status);
        return toResponse(request, target);
    }

    public Page<DataRequestResponse> list(String status, int page, int size) {
        PageRequest pageable = PageRequest.of(page, size);
        Page<DataRequest> result = (status == null || status.isBlank())
                ? dataRequestRepository.findAllByOrderByCreatedAtDesc(pageable)
                : dataRequestRepository.findByStatusOrderByDueDateAsc(
                        DataRequest.Status.valueOf(status.toUpperCase()), pageable);
        return result.map(r -> toResponse(r, userRepository.findById(r.getUserId()).orElse(null)));
    }

    public long openCount() {
        return dataRequestRepository.countByStatus(DataRequest.Status.OPEN);
    }

    /** Everything held on the user, for the ACCESS export the requester receives. */
    public Map<String, Object> exportUserData(User admin, UUID userId) {
        User target = userRepository.findById(userId)
                .orElseThrow(() -> new AppException("USER_NOT_FOUND", "User not found", HttpStatus.NOT_FOUND));

        Map<String, Object> bundle = new LinkedHashMap<>();
        bundle.put("exportedAt", LocalDateTime.now().toString());
        bundle.put("profile", userService.getProfile(target));
        walletRepository.findByUserId(userId).ifPresent(wallet -> bundle.put("wallet", Map.of(
                "balance", wallet.getBalance(),
                "currency", "GHS")));
        kycRecordRepository.findByUserId(userId).ifPresent(kyc -> bundle.put("kycStatus",
                target.getKycStatus() != null ? target.getKycStatus().name() : null));
        bundle.put("transactions", adminService.getUserTransactions(userId, 0, 1000).getContent());
        bundle.put("devices", userService.getDevices(target, null));

        auditService.log(admin, "EXPORT_USER_DATA", target, "DSAR access export");
        return bundle;
    }

    private DataRequestResponse toResponse(DataRequest r, User target) {
        return DataRequestResponse.builder()
                .id(r.getId().toString())
                .userId(r.getUserId().toString())
                .userName(target != null
                        ? ((target.getFirstName() != null ? target.getFirstName() : "") + " "
                        + (target.getLastName() != null ? target.getLastName() : "")).trim()
                        : null)
                .userEmail(target != null ? target.getEmail() : null)
                .type(r.getType().name())
                .status(r.getStatus().name())
                .dueDate(r.getDueDate().toString())
                .overdue(r.getStatus() != DataRequest.Status.COMPLETED
                        && r.getStatus() != DataRequest.Status.REJECTED
                        && r.getDueDate().isBefore(LocalDate.now()))
                .notes(r.getNotes())
                .createdAt(r.getCreatedAt() != null ? r.getCreatedAt().toString() : null)
                .completedAt(r.getCompletedAt() != null ? r.getCompletedAt().toString() : null)
                .build();
    }
}
