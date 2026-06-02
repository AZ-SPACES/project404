package com.aza.backend.service;

import com.aza.backend.entity.User;
import com.aza.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.jpa.repository.Query;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class DeletionSchedulerService {

    private final UserRepository userRepository;
    private final GdprErasureService gdprErasureService;

    /**
     * Runs daily at 03:00 UTC. Finds every PENDING_DELETION account whose
     * 30-day grace period has elapsed and erases them one by one.
     */
    @Scheduled(cron = "0 0 3 * * *")
    public void processScheduledDeletions() {
        List<User> due = userRepository.findDueForErasure(LocalDateTime.now());
        if (due.isEmpty()) return;

        log.info("GDPR scheduler: {} account(s) due for erasure", due.size());
        for (User user : due) {
            try {
                gdprErasureService.erase(user.getId());
            } catch (Exception e) {
                log.error("GDPR erasure failed for user {}: {}", user.getId(), e.getMessage(), e);
            }
        }
    }
}
