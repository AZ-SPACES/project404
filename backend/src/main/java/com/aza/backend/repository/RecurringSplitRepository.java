package com.aza.backend.repository;

import com.aza.backend.entity.RecurringSplit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface RecurringSplitRepository extends JpaRepository<RecurringSplit, UUID> {

    List<RecurringSplit> findAllByCreatorIdOrderByCreatedAtDesc(UUID creatorId);

    /** Due today or overdue — a run the scheduler missed is still owed. */
    @Query("SELECT r FROM RecurringSplit r WHERE r.active = true AND r.nextRunOn <= :on")
    List<RecurringSplit> findDue(@Param("on") LocalDate on);
}
