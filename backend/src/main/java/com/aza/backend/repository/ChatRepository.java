package com.aza.backend.repository;

import com.aza.backend.entity.Chat;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ChatRepository extends JpaRepository<Chat, UUID> {
    /**
     * Find all chats for a user, ordered by most recent message
     */
    @Query("SELECT c FROM Chat c WHERE c.participantOneId = :userId " +
            "OR c.participantTwoId = :userId " +
            "ORDER BY c.lastMessageAt DESC NULLS LAST")
    List<Chat> findAllByUserId(@Param("userId") UUID userId);

    /**
     * Ids of everyone the user shares a chat with — used to scope presence
     * event fan-out to people who actually know this user.
     */
    @Query("SELECT CASE WHEN c.participantOneId = :userId THEN c.participantTwoId " +
            "ELSE c.participantOneId END FROM Chat c " +
            "WHERE c.participantOneId = :userId OR c.participantTwoId = :userId")
    List<UUID> findPartnerIds(@Param("userId") UUID userId);

    /**
     * Find an existing 1:1 chat between two users
     */
    @Query("SELECT c FROM Chat c WHERE " +
            "(c.participantOneId = :userA AND c.participantTwoId = :userB) OR " +
            "(c.participantOneId = :userB AND c.participantTwoId = :userA)")
    Optional<Chat> findByParticipants(@Param("userA") UUID userA,
                                      @Param("userB") UUID userB);

    @Query("SELECT c FROM Chat c WHERE c.isSupport = true AND " +
            "(c.participantOneId = :userId OR c.participantTwoId = :userId)")
    Optional<Chat> findSupportChatByUserId(@Param("userId") UUID userId);

    @Query("SELECT c FROM Chat c WHERE c.isSupport = true ORDER BY c.lastMessageAt DESC NULLS LAST")
    org.springframework.data.domain.Page<Chat> findAllSupportChats(org.springframework.data.domain.Pageable pageable);

    @Query("SELECT c FROM Chat c WHERE c.isSupport = true AND c.status = :status ORDER BY c.lastMessageAt DESC NULLS LAST")
    org.springframework.data.domain.Page<Chat> findAllSupportChatsByStatus(
            @Param("status") Chat.ChatStatus status,
            org.springframework.data.domain.Pageable pageable);

    long countByIsSupportTrueAndStatus(Chat.ChatStatus status);

    long countByIsSupportTrue();

    long countByIsSupportTrueAndStatusAndResolvedAtAfter(
            Chat.ChatStatus status,
            java.time.LocalDateTime since);

    @Query("SELECT c.category, COUNT(c) FROM Chat c WHERE c.isSupport = true GROUP BY c.category")
    java.util.List<Object[]> countSupportChatsByCategory();

    @Query("SELECT c.priority, COUNT(c) FROM Chat c WHERE c.isSupport = true GROUP BY c.priority")
    java.util.List<Object[]> countSupportChatsByPriority();
}
