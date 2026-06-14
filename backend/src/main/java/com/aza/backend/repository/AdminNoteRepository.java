package com.aza.backend.repository;

import com.aza.backend.entity.AdminNote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AdminNoteRepository extends JpaRepository<AdminNote, UUID> {

    List<AdminNote> findBySubjectUserIdOrderByCreatedAtDesc(UUID subjectUserId);
}
