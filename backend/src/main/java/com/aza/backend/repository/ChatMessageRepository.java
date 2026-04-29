package com.aza.backend.repository;

import com.aza.backend.entity.ChatMessage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, UUID> {

    /**
     * Paginated message history — newest first
     */
    @Query("SELECT m FROM ChatMessage m WHERE m.chatId = :chatId " +
            "AND m.isDeleted = false " +
            "ORDER BY m.sentAt DESC")
    Page<ChatMessage> findByChatId(@Param("chatId") UUID chatId, Pageable pageable);

    /**
     * Find all unread messages in a chat for a specific recipient
     */
    @Query("SELECT m FROM ChatMessage m WHERE m.chatId = :chatId " +
            "AND m.senderId != :userId " +
            "AND m.status != 'READ' " +
            "AND m.isDeleted = false")
    List<ChatMessage> findUnreadMessages(@Param("chatId") UUID chatId,
                                         @Param("userId") UUID userId);

    /**
     * Mark all messages in a chat as delivered for a recipient
     */
    @Modifying
    @Query("UPDATE ChatMessage m SET m.status = 'DELIVERED', m.deliveredAt = CURRENT_TIMESTAMP " +
            "WHERE m.chatId = :chatId AND m.senderId != :userId AND m.status = 'SENT'")
    int markAsDelivered(@Param("chatId") UUID chatId, @Param("userId") UUID userId);

    /**
     * Mark all messages in a chat as read
     */
    @Modifying
    @Query("UPDATE ChatMessage m SET m.status = 'READ', m.readAt = CURRENT_TIMESTAMP " +
            "WHERE m.chatId = :chatId AND m.senderId != :userId AND m.status != 'READ'")
    int markAsRead(@Param("chatId") UUID chatId, @Param("userId") UUID userId);

    /**
     * Count unread messages across all chats for a user
     */
    @Query("SELECT COUNT(m) FROM ChatMessage m " +
            "JOIN Chat c ON c.id = m.chatId " +
            "WHERE (c.participantOneId = :userId OR c.participantTwoId = :userId) " +
            "AND m.senderId != :userId " +
            "AND m.status != 'READ' " +
            "AND m.isDeleted = false")
    long countTotalUnread(@Param("userId") UUID userId);

    /** Find messages whose disappearing-message timer has elapsed and haven't been wiped yet. */
    @Query("SELECT m FROM ChatMessage m WHERE m.expiresAt IS NOT NULL " +
           "AND m.expiresAt <= :now AND m.isDeleted = false")
    List<ChatMessage> findExpiredMessages(@Param("now") LocalDateTime now);
}
