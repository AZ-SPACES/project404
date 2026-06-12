package com.aza.backend.service;

import com.aza.backend.dto.admin.ScreeningMatchResponse;
import com.aza.backend.entity.RiskAlert;
import com.aza.backend.entity.SanctionsListEntry;
import com.aza.backend.entity.ScreeningMatch;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.RiskAlertRepository;
import com.aza.backend.repository.SanctionsListEntryRepository;
import com.aza.backend.repository.ScreeningMatchRepository;
import com.aza.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

/**
 * Sanctions/PEP screening: matches user names against watchlist entries.
 * Matching is deliberately fuzzy (most real hits aren't exact strings) and
 * deliberately conservative about re-raising: once a (user, entry) pair has a
 * match record — including FALSE_POSITIVE — reruns never create a duplicate.
 * Confirming a match raises a RiskAlert in the existing risk queue.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ScreeningService {

    private final SanctionsListEntryRepository listRepository;
    private final ScreeningMatchRepository matchRepository;
    private final UserRepository userRepository;
    private final RiskAlertRepository riskAlertRepository;
    private final AdminAuditService auditService;

    private static final int SCORE_THRESHOLD = 70;

    // ── List management ───────────────────────────────────────────────────────

    @Transactional
    public SanctionsListEntry addEntry(User admin, String listName, String fullName,
                                       SanctionsListEntry.EntryType type, String country, String notes) {
        if (listName == null || listName.isBlank() || fullName == null || fullName.isBlank()) {
            throw new AppException("INVALID_ENTRY", "List name and full name are required", HttpStatus.BAD_REQUEST);
        }
        SanctionsListEntry entry = listRepository.save(SanctionsListEntry.builder()
                .listName(listName.trim())
                .fullName(fullName.trim())
                .normalizedName(normalize(fullName))
                .entryType(type)
                .country(country)
                .notes(notes)
                .addedBy(admin.getId())
                .build());
        auditService.log(admin, "ADD_WATCHLIST_ENTRY", null,
                "list=" + listName + " name=" + fullName + " type=" + type);
        return entry;
    }

    /** CSV lines: listName,fullName,type,country (type SANCTION|PEP; header row optional). */
    @Transactional
    public int importEntries(User admin, String csv) {
        if (csv == null || csv.isBlank()) {
            throw new AppException("INVALID_CSV", "CSV content is required", HttpStatus.BAD_REQUEST);
        }
        int imported = 0;
        for (String line : csv.split("\\r?\\n")) {
            line = line.trim();
            if (line.isEmpty() || line.toLowerCase().startsWith("listname") || line.toLowerCase().startsWith("list_name")) continue;
            String[] cols = line.split(",");
            if (cols.length < 3) {
                throw new AppException("INVALID_CSV",
                        "Each line must be: listName,fullName,type[,country] — got: " + line, HttpStatus.BAD_REQUEST);
            }
            SanctionsListEntry.EntryType type;
            try {
                type = SanctionsListEntry.EntryType.valueOf(cols[2].trim().toUpperCase());
            } catch (IllegalArgumentException e) {
                throw new AppException("INVALID_CSV", "Type must be SANCTION or PEP in line: " + line, HttpStatus.BAD_REQUEST);
            }
            listRepository.save(SanctionsListEntry.builder()
                    .listName(cols[0].trim())
                    .fullName(cols[1].trim())
                    .normalizedName(normalize(cols[1]))
                    .entryType(type)
                    .country(cols.length > 3 ? cols[3].trim() : null)
                    .addedBy(admin.getId())
                    .build());
            imported++;
        }
        auditService.log(admin, "IMPORT_WATCHLIST", null, "entries=" + imported);
        return imported;
    }

    @Transactional
    public void deactivateEntry(User admin, UUID entryId) {
        SanctionsListEntry entry = listRepository.findById(entryId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "List entry not found", HttpStatus.NOT_FOUND));
        entry.setActive(false);
        listRepository.save(entry);
        auditService.log(admin, "DEACTIVATE_WATCHLIST_ENTRY", null,
                "list=" + entry.getListName() + " name=" + entry.getFullName());
    }

    public List<SanctionsListEntry> listEntries() {
        return listRepository.findAllByOrderByCreatedAtDesc();
    }

    // ── Screening ─────────────────────────────────────────────────────────────

    /** Screens every user against active entries. Returns the number of new matches raised. */
    @Transactional
    public int screenAllUsers() {
        List<SanctionsListEntry> entries = listRepository.findByActiveTrue();
        if (entries.isEmpty()) return 0;
        int raised = 0;
        for (User user : userRepository.findAll()) {
            raised += screen(user, entries);
        }
        if (raised > 0) {
            log.info("Screening raised {} new potential watchlist matches", raised);
        }
        return raised;
    }

    private int screen(User user, List<SanctionsListEntry> entries) {
        String userName = normalize((nullSafe(user.getFirstName()) + " " + nullSafe(user.getLastName())));
        if (userName.isBlank()) return 0;
        int raised = 0;
        for (SanctionsListEntry entry : entries) {
            int score = matchScore(userName, entry.getNormalizedName());
            if (score >= SCORE_THRESHOLD
                    && !matchRepository.existsByUserIdAndListEntryId(user.getId(), entry.getId())) {
                matchRepository.save(ScreeningMatch.builder()
                        .userId(user.getId())
                        .listEntryId(entry.getId())
                        .listName(entry.getListName())
                        .listEntryName(entry.getFullName())
                        .entryType(entry.getEntryType())
                        .matchScore(score)
                        .build());
                raised++;
            }
        }
        return raised;
    }

    /**
     * 100 = identical normalized names; 85 = every token of one name appears in
     * the other (handles middle names); 70 = at least two shared tokens.
     */
    static int matchScore(String a, String b) {
        if (a.equals(b)) return 100;
        Set<String> tokensA = new HashSet<>(Arrays.asList(a.split(" ")));
        Set<String> tokensB = new HashSet<>(Arrays.asList(b.split(" ")));
        tokensA.remove("");
        tokensB.remove("");
        if (tokensA.isEmpty() || tokensB.isEmpty()) return 0;
        if (tokensA.containsAll(tokensB) || tokensB.containsAll(tokensA)) return 85;
        Set<String> shared = new HashSet<>(tokensA);
        shared.retainAll(tokensB);
        return shared.size() >= 2 ? 70 : 0;
    }

    static String normalize(String name) {
        if (name == null) return "";
        return name.toLowerCase().replaceAll("[^a-z\\s]", " ").replaceAll("\\s+", " ").trim();
    }

    // ── Match review ──────────────────────────────────────────────────────────

    @Transactional
    public ScreeningMatchResponse reviewMatch(User admin, UUID matchId, boolean confirmed, String notes) {
        ScreeningMatch match = matchRepository.findById(matchId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Match not found", HttpStatus.NOT_FOUND));
        if (match.getStatus() != ScreeningMatch.Status.PENDING_REVIEW) {
            throw new AppException("ALREADY_REVIEWED", "Match is " + match.getStatus(), HttpStatus.CONFLICT);
        }
        match.setStatus(confirmed ? ScreeningMatch.Status.CONFIRMED : ScreeningMatch.Status.FALSE_POSITIVE);
        match.setNotes(notes);
        match.setReviewedBy(admin.getId());
        match.setReviewedAt(LocalDateTime.now());
        matchRepository.save(match);

        User target = userRepository.findById(match.getUserId()).orElse(null);
        if (confirmed) {
            riskAlertRepository.save(RiskAlert.builder()
                    .userId(match.getUserId())
                    .alertType(match.getEntryType() == SanctionsListEntry.EntryType.PEP
                            ? RiskAlert.AlertType.PEP_MATCH
                            : RiskAlert.AlertType.BLACKLIST_MATCH)
                    .severity(RiskAlert.Severity.CRITICAL)
                    .description("Confirmed watchlist match: " + match.getListEntryName()
                            + " (" + match.getListName() + "), score " + match.getMatchScore())
                    .riskScore(match.getMatchScore())
                    .build());
        }
        auditService.log(admin, confirmed ? "CONFIRM_SCREENING_MATCH" : "DISMISS_SCREENING_MATCH",
                target, "list=" + match.getListName() + " entry=" + match.getListEntryName());
        return toResponse(match, target);
    }

    public Page<ScreeningMatchResponse> listMatches(String status, int page, int size) {
        PageRequest pageable = PageRequest.of(page, size);
        Page<ScreeningMatch> matches = (status == null || status.isBlank())
                ? matchRepository.findAllByOrderByCreatedAtDesc(pageable)
                : matchRepository.findByStatusOrderByMatchScoreDescCreatedAtDesc(
                        ScreeningMatch.Status.valueOf(status.toUpperCase()), pageable);
        return matches.map(m -> toResponse(m, userRepository.findById(m.getUserId()).orElse(null)));
    }

    public Map<String, Long> stats() {
        return Map.of(
                "pendingMatches", matchRepository.countByStatus(ScreeningMatch.Status.PENDING_REVIEW),
                "activeListEntries", listRepository.countByActiveTrue());
    }

    private ScreeningMatchResponse toResponse(ScreeningMatch m, User user) {
        return ScreeningMatchResponse.builder()
                .id(m.getId().toString())
                .userId(m.getUserId().toString())
                .userName(user != null ? (nullSafe(user.getFirstName()) + " " + nullSafe(user.getLastName())).trim() : null)
                .userEmail(user != null ? user.getEmail() : null)
                .listName(m.getListName())
                .listEntryName(m.getListEntryName())
                .entryType(m.getEntryType().name())
                .matchScore(m.getMatchScore())
                .status(m.getStatus().name())
                .notes(m.getNotes())
                .createdAt(m.getCreatedAt() != null ? m.getCreatedAt().toString() : null)
                .reviewedAt(m.getReviewedAt() != null ? m.getReviewedAt().toString() : null)
                .build();
    }

    private static String nullSafe(String value) {
        return value != null ? value : "";
    }
}
