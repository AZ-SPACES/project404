package com.aza.backend.service;

import com.aza.backend.dto.admin.ScreeningMatchResponse;
import com.aza.backend.entity.RiskAlert;
import com.aza.backend.entity.SanctionsListEntry;
import com.aza.backend.entity.ScreeningMatch;
import com.aza.backend.entity.StaffRole;
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

import java.time.LocalDate;
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
    private final StaffAlertService staffAlertService;

    private static final int SCORE_THRESHOLD = 70;

    // ── List management ───────────────────────────────────────────────────────

    @Transactional
    public SanctionsListEntry addEntry(User admin, String listName, String fullName,
                                       SanctionsListEntry.EntryType type, String country,
                                       LocalDate dateOfBirth, String notes) {
        if (listName == null || listName.isBlank() || fullName == null || fullName.isBlank()) {
            throw new AppException("INVALID_ENTRY", "List name and full name are required", HttpStatus.BAD_REQUEST);
        }
        SanctionsListEntry entry = listRepository.save(SanctionsListEntry.builder()
                .listName(listName.trim())
                .fullName(fullName.trim())
                .normalizedName(normalize(fullName))
                .entryType(type)
                .country(country)
                .dateOfBirth(dateOfBirth)
                .notes(notes)
                .addedBy(admin.getId())
                .build());
        auditService.log(admin, "ADD_WATCHLIST_ENTRY", null,
                "list=" + listName + " name=" + fullName + " type=" + type);
        return entry;
    }

    /** CSV lines: listName,fullName,type[,country[,dateOfBirth]] (type SANCTION|PEP; header row optional). */
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
                    .country(cols.length > 3 && !cols[3].isBlank() ? cols[3].trim() : null)
                    .dateOfBirth(cols.length > 4 ? parseDob(cols[4].trim(), line) : null)
                    .addedBy(admin.getId())
                    .build());
            imported++;
        }
        auditService.log(admin, "IMPORT_WATCHLIST", null, "entries=" + imported);
        return imported;
    }

    private LocalDate parseDob(String raw, String line) {
        if (raw.isBlank()) return null;
        try {
            return LocalDate.parse(raw);
        } catch (Exception e) {
            throw new AppException("INVALID_CSV", "Bad dateOfBirth (use YYYY-MM-DD) in line: " + line, HttpStatus.BAD_REQUEST);
        }
    }

    /**
     * Imports the UN Security Council consolidated sanctions list from its
     * published XML feed. Already-active (listName, normalizedName) pairs are
     * skipped, so re-imports only add new designations.
     */
    @Transactional
    public int importUnConsolidatedList(User admin, String url) {
        String feedUrl = (url == null || url.isBlank())
                ? "https://scsanctions.un.org/resources/xml/en/consolidated.xml"
                : url;
        org.w3c.dom.Document doc;
        try {
            java.net.http.HttpClient client = java.net.http.HttpClient.newBuilder()
                    .connectTimeout(java.time.Duration.ofSeconds(20))
                    .followRedirects(java.net.http.HttpClient.Redirect.NORMAL)
                    .build();
            java.net.http.HttpRequest request = java.net.http.HttpRequest.newBuilder()
                    .uri(java.net.URI.create(feedUrl))
                    .timeout(java.time.Duration.ofSeconds(60))
                    .GET()
                    .build();
            java.net.http.HttpResponse<byte[]> response =
                    client.send(request, java.net.http.HttpResponse.BodyHandlers.ofByteArray());
            if (response.statusCode() != 200) {
                throw new AppException("UN_FEED_ERROR",
                        "UN list feed returned HTTP " + response.statusCode(), HttpStatus.BAD_GATEWAY);
            }
            javax.xml.parsers.DocumentBuilderFactory factory = javax.xml.parsers.DocumentBuilderFactory.newInstance();
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setXIncludeAware(false);
            factory.setExpandEntityReferences(false);
            doc = factory.newDocumentBuilder().parse(new java.io.ByteArrayInputStream(response.body()));
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            throw new AppException("UN_FEED_ERROR", "Failed to fetch/parse UN list: " + e.getMessage(), HttpStatus.BAD_GATEWAY);
        }

        int imported = 0;
        org.w3c.dom.NodeList individuals = doc.getElementsByTagName("INDIVIDUAL");
        for (int i = 0; i < individuals.getLength(); i++) {
            org.w3c.dom.Element individual = (org.w3c.dom.Element) individuals.item(i);
            String fullName = String.join(" ",
                            childText(individual, "FIRST_NAME"),
                            childText(individual, "SECOND_NAME"),
                            childText(individual, "THIRD_NAME"),
                            childText(individual, "FOURTH_NAME"))
                    .replaceAll("\\s+", " ").trim();
            if (fullName.isBlank()) continue;
            String normalized = normalize(fullName);
            if (normalized.isBlank()
                    || listRepository.existsByListNameAndNormalizedNameAndActiveTrue("UN", normalized)) {
                continue;
            }
            listRepository.save(SanctionsListEntry.builder()
                    .listName("UN")
                    .fullName(fullName)
                    .normalizedName(normalized)
                    .entryType(SanctionsListEntry.EntryType.SANCTION)
                    .country(nestedText(individual, "NATIONALITY", "VALUE"))
                    .dateOfBirth(parseUnDob(individual))
                    .addedBy(admin.getId())
                    .build());
            imported++;
        }
        auditService.log(admin, "IMPORT_UN_LIST", null, "entries=" + imported + " source=" + feedUrl);
        return imported;
    }

    private static String childText(org.w3c.dom.Element parent, String tag) {
        org.w3c.dom.NodeList nodes = parent.getElementsByTagName(tag);
        if (nodes.getLength() == 0) return "";
        // Direct child only — INDIVIDUAL contains nested structures reusing tag names
        for (int i = 0; i < nodes.getLength(); i++) {
            if (nodes.item(i).getParentNode() == parent) {
                String text = nodes.item(i).getTextContent();
                return text != null ? text.trim() : "";
            }
        }
        return "";
    }

    private static String nestedText(org.w3c.dom.Element parent, String containerTag, String valueTag) {
        org.w3c.dom.NodeList containers = parent.getElementsByTagName(containerTag);
        if (containers.getLength() == 0) return null;
        org.w3c.dom.NodeList values = ((org.w3c.dom.Element) containers.item(0)).getElementsByTagName(valueTag);
        if (values.getLength() == 0) return null;
        String text = values.item(0).getTextContent();
        return text != null && !text.isBlank() ? text.trim() : null;
    }

    private static LocalDate parseUnDob(org.w3c.dom.Element individual) {
        org.w3c.dom.NodeList dobs = individual.getElementsByTagName("INDIVIDUAL_DATE_OF_BIRTH");
        if (dobs.getLength() == 0) return null;
        String date = nestedText(individual, "INDIVIDUAL_DATE_OF_BIRTH", "DATE");
        if (date == null) return null; // YEAR-only entries carry too little signal
        try {
            return LocalDate.parse(date.length() > 10 ? date.substring(0, 10) : date);
        } catch (Exception e) {
            return null;
        }
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
            staffAlertService.alertRole(StaffRole.Role.COMPLIANCE, "Watchlist matches pending review",
                    raised + " new potential watchlist match(es) need review in Sanctions Screening.");
        }
        return raised;
    }

    /**
     * Screens a single user (e.g. at registration). Never throws — screening
     * problems must not block signup; the daily batch is the backstop.
     */
    public void screenNewUser(User user) {
        try {
            List<SanctionsListEntry> entries = listRepository.findByActiveTrue();
            if (entries.isEmpty()) return;
            int raised = screen(user, entries);
            if (raised > 0) {
                log.warn("New user {} matched {} watchlist entries at registration", user.getId(), raised);
                staffAlertService.alertRole(StaffRole.Role.COMPLIANCE, "New signup matched watchlist",
                        "A user who just registered matched " + raised
                                + " watchlist entr" + (raised == 1 ? "y" : "ies") + " — review in Sanctions Screening.");
            }
        } catch (Exception e) {
            log.error("Registration screening failed for user {}: {}", user.getId(), e.getMessage());
        }
    }

    private int screen(User user, List<SanctionsListEntry> entries) {
        String userName = normalize((nullSafe(user.getFirstName()) + " " + nullSafe(user.getLastName())));
        if (userName.isBlank()) return 0;
        int raised = 0;
        for (SanctionsListEntry entry : entries) {
            int score = matchScore(userName, entry.getNormalizedName());
            // DOB disambiguation: a name hit with a different birth date is noise;
            // the same birth date makes it near-certain.
            if (score > 0 && entry.getDateOfBirth() != null && user.getDateOfBirth() != null) {
                score = entry.getDateOfBirth().equals(user.getDateOfBirth())
                        ? Math.min(100, score + 15)
                        : 0;
            }
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
