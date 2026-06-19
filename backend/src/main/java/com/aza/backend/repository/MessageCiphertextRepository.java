package com.aza.backend.repository;

import com.aza.backend.entity.MessageCiphertext;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface MessageCiphertextRepository extends JpaRepository<MessageCiphertext, UUID> {

    List<MessageCiphertext> findByMessageId(UUID messageId);

    /** Batch-load envelopes for a page of messages in one query (avoids N+1). */
    List<MessageCiphertext> findByMessageIdIn(Collection<UUID> messageIds);

    void deleteByMessageId(UUID messageId);
}
