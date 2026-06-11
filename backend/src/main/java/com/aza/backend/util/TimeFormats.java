package com.aza.backend.util;

import java.time.LocalDateTime;
import java.time.ZoneId;

/**
 * Server-local LocalDateTimes → UTC ISO-8601 strings (with the trailing Z).
 * Clients parse timestamps with {@code new Date(iso)}, which assumes local time
 * when no zone is present — so every timestamp that crosses the wire must carry
 * one. Jackson handles DTO fields via {@code JacksonConfig}; use this for
 * timestamps that are stringified manually.
 */
public final class TimeFormats {

    private TimeFormats() {
    }

    public static String toUtcIso(LocalDateTime localDateTime) {
        if (localDateTime == null) return null;
        return localDateTime.atZone(ZoneId.systemDefault()).toInstant().toString();
    }
}
