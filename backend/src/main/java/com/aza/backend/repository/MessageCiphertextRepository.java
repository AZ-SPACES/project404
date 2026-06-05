package com.aza.backend.repository;

import com.aza.backend.entity.MessageCiphertext;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MessageCiphertextRepository extends JpaRepository<MessageCiphertext, UUID> {

    List<MessageCiphertext> findByMessageId(UUID messageId);

    void deleteByMessageId(UUID messageId);
}
