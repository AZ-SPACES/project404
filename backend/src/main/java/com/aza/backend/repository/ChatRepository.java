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
     * Find an existing 1:1 chat between two users
     */
    @Query("SELECT c FROM Chat c WHERE " +
            "(c.participantOneId = :userA AND c.participantTwoId = :userB) OR " +
            "(c.participantOneId = :userB AND c.participantTwoId = :userA)")
    Optional<Chat> findByParticipants(@Param("userA") UUID userA,
                                      @Param("userB") UUID userB);
}
