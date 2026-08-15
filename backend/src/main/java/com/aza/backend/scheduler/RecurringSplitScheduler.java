package com.aza.backend.scheduler;

import com.aza.backend.service.RecurringSplitService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneId;

/**
 * Produces the month's rent splits, and the week's.
 *
 * Runs hourly rather than once a day so a server that was down at the hour still catches
 * up the same morning. Producing twice is not a risk: each run is keyed by its period, so
 * a repeat finds the split it already made.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class RecurringSplitScheduler {

    private static final ZoneId GHANA_TZ = ZoneId.of("Africa/Accra");

    private final RecurringSplitService recurringSplitService;

    @Scheduled(cron = "0 15 * * * *")
    public void run() {
        try {
            recurringSplitService.runDue(LocalDate.now(GHANA_TZ));
        } catch (Exception e) {
            log.error("Recurring split sweep failed", e);
        }
    }
}
