package com.aza.backend.repository;

import com.aza.backend.entity.RecurringSplitParticipant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RecurringSplitParticipantRepository extends JpaRepository<RecurringSplitParticipant, UUID> {

    List<RecurringSplitParticipant> findAllByRecurringSplitId(UUID recurringSplitId);

    void deleteAllByRecurringSplitId(UUID recurringSplitId);
}
