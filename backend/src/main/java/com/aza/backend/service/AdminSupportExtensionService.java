package com.aza.backend.service;

import com.aza.backend.dto.admin.CannedResponseDto;
import com.aza.backend.dto.admin.SupportAnalyticsResponse;
import com.aza.backend.dto.admin.SupportNoteResponse;
import com.aza.backend.entity.CannedResponse;
import com.aza.backend.entity.Chat;
import com.aza.backend.entity.SupportNote;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.CannedResponseRepository;
import com.aza.backend.repository.ChatRepository;
import com.aza.backend.repository.SupportNoteRepository;
import com.aza.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AdminSupportExtensionService {

    private final SupportNoteRepository noteRepository;
    private final CannedResponseRepository cannedRepository;
    private final ChatRepository chatRepository;

    // ── Internal Notes ────────────────────────────────────────────────────────

    public List<SupportNoteResponse> getNotes(UUID chatId) {
        return noteRepository.findByChatIdOrderByCreatedAtAsc(chatId)
                .stream().map(this::toNoteResponse).toList();
    }

    @Transactional
    public SupportNoteResponse addNote(User agent, UUID chatId, String content) {
        if (content == null || content.isBlank()) {
            throw new AppException("INVALID_CONTENT", "Note content cannot be empty", HttpStatus.BAD_REQUEST);
        }
        chatRepository.findById(chatId)
                .orElseThrow(() -> new AppException("CHAT_NOT_FOUND", "Support chat not found", HttpStatus.NOT_FOUND));

        SupportNote note = SupportNote.builder()
                .chatId(chatId)
                .authorId(agent.getId())
                .authorName(agent.getFirstName() + " " + agent.getLastName())
                .content(content.strip())
                .build();
        return toNoteResponse(noteRepository.save(note));
    }

    // ── Canned Responses ──────────────────────────────────────────────────────

    public List<CannedResponseDto> getCannedResponses() {
        return cannedRepository.findAllByOrderByUsageCountDescTitleAsc()
                .stream().map(this::toCannedDto).toList();
    }

    @Transactional
    public CannedResponseDto createCannedResponse(User agent, String title, String content, String category) {
        CannedResponse cr = CannedResponse.builder()
                .title(title.strip())
                .content(content.strip())
                .category(category.strip().toUpperCase())
                .createdBy(agent.getId())
                .build();
        return toCannedDto(cannedRepository.save(cr));
    }

    @Transactional
    public void deleteCannedResponse(UUID id) {
        if (!cannedRepository.existsById(id)) {
            throw new AppException("NOT_FOUND", "Canned response not found", HttpStatus.NOT_FOUND);
        }
        cannedRepository.deleteById(id);
    }

    // ── Category update ───────────────────────────────────────────────────────

    @Transactional
    public void updateCategory(UUID chatId, String category) {
        Chat chat = chatRepository.findById(chatId)
                .orElseThrow(() -> new AppException("CHAT_NOT_FOUND", "Support chat not found", HttpStatus.NOT_FOUND));
        chat.setCategory(category);
        chatRepository.save(chat);
    }

    // ── Support analytics ─────────────────────────────────────────────────────

    public SupportAnalyticsResponse getAnalytics() {
        long total = chatRepository.countByIsSupportTrue();
        long open = chatRepository.countByIsSupportTrueAndStatus(Chat.ChatStatus.OPEN);

        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        long resolvedToday = chatRepository.countByIsSupportTrueAndStatusAndResolvedAtAfter(
                Chat.ChatStatus.RESOLVED, startOfDay);

        // Category breakdown
        List<SupportAnalyticsResponse.CategoryCount> byCategory =
                chatRepository.countSupportChatsByCategory().stream()
                        .map(row -> SupportAnalyticsResponse.CategoryCount.builder()
                                .category(row[0] != null ? (String) row[0] : "GENERAL")
                                .count((Long) row[1])
                                .build())
                        .toList();

        // Priority breakdown
        List<SupportAnalyticsResponse.PriorityCount> byPriority =
                chatRepository.countSupportChatsByPriority().stream()
                        .map(row -> SupportAnalyticsResponse.PriorityCount.builder()
                                .priority(row[0] != null ? row[0].toString() : "NORMAL")
                                .count((Long) row[1])
                                .build())
                        .toList();

        return SupportAnalyticsResponse.builder()
                .totalTickets(total)
                .openTickets(open)
                .resolvedToday(resolvedToday)
                .avgFirstResponseMinutes(0)   // requires message timestamps analysis
                .avgResolutionHours(0)
                .slaComplianceRate(0)
                .byCategory(byCategory)
                .byPriority(byPriority)
                .recentTrend(List.of())
                .build();
    }

    // ── Mappers ───────────────────────────────────────────────────────────────

    private SupportNoteResponse toNoteResponse(SupportNote n) {
        return SupportNoteResponse.builder()
                .id(n.getId().toString())
                .chatId(n.getChatId().toString())
                .authorId(n.getAuthorId().toString())
                .authorName(n.getAuthorName())
                .content(n.getContent())
                .createdAt(n.getCreatedAt())
                .build();
    }

    private CannedResponseDto toCannedDto(CannedResponse cr) {
        return CannedResponseDto.builder()
                .id(cr.getId().toString())
                .title(cr.getTitle())
                .content(cr.getContent())
                .category(cr.getCategory())
                .usageCount(cr.getUsageCount())
                .createdAt(cr.getCreatedAt())
                .build();
    }
}
