package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.zaxxer.hikari.HikariDataSource;
import com.zaxxer.hikari.HikariPoolMXBean;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Properties;

@RestController
@RequestMapping("/api/v1/admin/health")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminHealthController {

    private final DataSource dataSource;
    private final StringRedisTemplate redisTemplate;

    @GetMapping("/metrics")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getMetrics() {
        Map<String, Object> result = new LinkedHashMap<>();

        // JVM
        Runtime rt = Runtime.getRuntime();
        long totalMb = rt.totalMemory() / (1024 * 1024);
        long freeMb = rt.freeMemory() / (1024 * 1024);
        long maxMb = rt.maxMemory() / (1024 * 1024);
        result.put("jvm", Map.of(
                "heapUsedMb", totalMb - freeMb,
                "heapTotalMb", totalMb,
                "heapMaxMb", maxMb,
                "heapUsedPct", (int) (((double)(totalMb - freeMb) / maxMb) * 100),
                "processors", rt.availableProcessors()
        ));

        // DB pool
        try {
            if (dataSource instanceof HikariDataSource hikari) {
                HikariPoolMXBean pool = hikari.getHikariPoolMXBean();
                result.put("db", Map.of(
                        "status", "UP",
                        "activeConnections", pool != null ? pool.getActiveConnections() : 0,
                        "idleConnections", pool != null ? pool.getIdleConnections() : 0,
                        "totalConnections", pool != null ? pool.getTotalConnections() : 0,
                        "poolMax", hikari.getMaximumPoolSize()
                ));
            } else {
                try (var conn = dataSource.getConnection()) {
                    result.put("db", Map.of("status", "UP", "product",
                            conn.getMetaData().getDatabaseProductVersion()));
                }
            }
        } catch (Exception e) {
            result.put("db", Map.of("status", "DOWN", "error", e.getMessage()));
        }

        // Redis
        try {
            Properties info = redisTemplate.execute(connection -> {
                try {
                    return connection.serverCommands().info("memory");
                } catch (Exception ex) {
                    return null;
                }
            }, true);
            if (info != null) {
                result.put("redis", Map.of(
                        "status", "UP",
                        "usedMemoryMb", toMb(info.getProperty("used_memory", "0")),
                        "peakMemoryMb", toMb(info.getProperty("used_memory_peak", "0")),
                        "maxMemoryMb", toMb(info.getProperty("maxmemory", "0"))
                ));
            } else {
                result.put("redis", Map.of("status", "DOWN"));
            }
        } catch (Exception e) {
            result.put("redis", Map.of("status", "DOWN", "error", e.getMessage()));
        }

        // Thread counts
        result.put("threads", Map.of(
                "active", Thread.activeCount(),
                "daemon", Thread.getAllStackTraces().values().stream()
                        .filter(s -> s.length > 0).count()
        ));

        return ResponseEntity.ok(ApiResponse.success(result));
    }

    private long toMb(String bytes) {
        try { return Long.parseLong(bytes) / (1024 * 1024); } catch (Exception e) { return 0; }
    }
}
