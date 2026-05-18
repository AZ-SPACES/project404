package com.aza.backend.repository;

import com.aza.backend.entity.SupportNote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SupportNoteRepository extends JpaRepository<SupportNote, UUID> {
    List<SupportNote> findByChatIdOrderByCreatedAtAsc(UUID chatId);
}
