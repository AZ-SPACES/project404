package com.aza.backend.service;

import com.aza.backend.entity.AdminAuditLog;
import com.aza.backend.entity.AuditAnchor;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.AdminAuditLogRepository;
import com.aza.backend.repository.AuditAnchorRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;

/**
 * Hash-chains the admin audit log day by day so tampering with history is
 * detectable: each anchor commits to the previous anchor and to a canonical
 * rendering of that day's entries.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AuditAnchorService {

    private final AuditAnchorRepository anchorRepository;
    private final AdminAuditLogRepository auditLogRepository;

    private static final String GENESIS = "GENESIS";

    /** Anchors every un-anchored day from the earliest entry/last anchor up to yesterday. */
    @Transactional
    public int anchorUpToYesterday() {
        LocalDate yesterday = LocalDate.now().minusDays(1);
        LocalDate next = anchorRepository.findFirstByOrderByAnchorDateDesc()
                .map(a -> a.getAnchorDate().plusDays(1))
                .orElseGet(() -> earliestEntryDate(yesterday));
        int created = 0;
        while (!next.isAfter(yesterday)) {
            anchorDay(next);
            created++;
            next = next.plusDays(1);
        }
        if (created > 0) {
            log.info("Created {} audit anchors up to {}", created, yesterday);
        }
        return created;
    }

    @Transactional
    public AuditAnchor anchorDay(LocalDate day) {
        anchorRepository.findByAnchorDate(day).ifPresent(a -> {
            throw new AppException("ALREADY_ANCHORED", "Day " + day + " is already anchored",
                    org.springframework.http.HttpStatus.CONFLICT);
        });
        String prevHash = anchorRepository.findFirstByOrderByAnchorDateDesc()
                .map(AuditAnchor::getContentHash)
                .orElse(GENESIS);
        List<AdminAuditLog> entries = entriesFor(day);
        return anchorRepository.save(AuditAnchor.builder()
                .anchorDate(day)
                .entryCount(entries.size())
                .contentHash(hash(prevHash, entries))
                .prevHash(prevHash)
                .build());
    }

    /** Recomputes every anchor from the live audit rows; a false day means tampering (or row loss). */
    public List<VerificationResult> verifyChain() {
        List<VerificationResult> results = new ArrayList<>();
        String prevHash = GENESIS;
        for (AuditAnchor anchor : anchorRepository.findAllByOrderByAnchorDateAsc()) {
            List<AdminAuditLog> entries = entriesFor(anchor.getAnchorDate());
            boolean chainOk = anchor.getPrevHash().equals(prevHash);
            boolean contentOk = anchor.getContentHash().equals(hash(anchor.getPrevHash(), entries))
                    && entries.size() == anchor.getEntryCount();
            results.add(new VerificationResult(anchor.getAnchorDate().toString(),
                    chainOk && contentOk, anchor.getEntryCount(), entries.size()));
            prevHash = anchor.getContentHash();
        }
        return results;
    }

    public List<AuditAnchor> recentAnchors() {
        return anchorRepository.findTop30ByOrderByAnchorDateDesc();
    }

    private List<AdminAuditLog> entriesFor(LocalDate day) {
        return auditLogRepository.findByTimestampGreaterThanEqualAndTimestampLessThanOrderByTimestampAscIdAsc(
                day.atStartOfDay(), day.plusDays(1).atStartOfDay());
    }

    private LocalDate earliestEntryDate(LocalDate fallback) {
        return auditLogRepository.findAll().stream()
                .map(e -> e.getTimestamp().toLocalDate())
                .min(LocalDate::compareTo)
                .orElse(fallback);
    }

    private static String hash(String prevHash, List<AdminAuditLog> entries) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            digest.update(prevHash.getBytes(StandardCharsets.UTF_8));
            for (AdminAuditLog entry : entries) {
                String canonical = entry.getId() + "|" + entry.getAdminId() + "|" + entry.getAdminEmail()
                        + "|" + entry.getAction() + "|" + entry.getTargetUserId()
                        + "|" + entry.getDetails() + "|" + entry.getTimestamp();
                digest.update(canonical.getBytes(StandardCharsets.UTF_8));
                digest.update((byte) 0x0A);
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (Exception e) {
            throw new AppException("Failed to compute audit anchor hash", e);
        }
    }

    public record VerificationResult(String date, boolean valid, long anchoredCount, long currentCount) {}
}
