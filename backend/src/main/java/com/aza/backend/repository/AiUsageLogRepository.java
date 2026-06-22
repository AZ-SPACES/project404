package com.aza.backend.repository;

import com.aza.backend.entity.AiUsageLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface AiUsageLogRepository extends JpaRepository<AiUsageLog, UUID> {

    long countByCreatedAtAfter(LocalDateTime since);

    long countByBlockedTrueAndCreatedAtAfter(LocalDateTime since);

    @Query("SELECT COUNT(DISTINCT a.userId) FROM AiUsageLog a WHERE a.createdAt >= :since")
    long countDistinctUsersSince(@Param("since") LocalDateTime since);

    /** [endpoint, count] for all calls in the window. */
    @Query("SELECT a.endpoint, COUNT(a) FROM AiUsageLog a WHERE a.createdAt >= :since GROUP BY a.endpoint")
    List<Object[]> countByEndpointSince(@Param("since") LocalDateTime since);

    /** [topic, count] for successful (non-blocked) calls — what the assistant is used for. */
    @Query("SELECT COALESCE(a.topic, 'OTHER'), COUNT(a) FROM AiUsageLog a " +
           "WHERE a.blocked = false AND a.createdAt >= :since GROUP BY a.topic ORDER BY COUNT(a) DESC")
    List<Object[]> countByTopicSince(@Param("since") LocalDateTime since);

    /** [day(date), count] for the daily volume sparkline. */
    @Query(value = "SELECT CAST(created_at AS DATE) AS d, COUNT(*) FROM ai_usage_log " +
                   "WHERE created_at >= :since GROUP BY d ORDER BY d", nativeQuery = true)
    List<Object[]> dailyVolumeSince(@Param("since") LocalDateTime since);

    /**
     * Per-user rollup for the top-users / abuse-alert table:
     * [user_id, total, blocked_count, other_topic_count, last_used_at].
     */
    @Query(value = "SELECT user_id, COUNT(*) AS total, " +
                   "SUM(CASE WHEN blocked THEN 1 ELSE 0 END) AS blocked_count, " +
                   "SUM(CASE WHEN topic = 'OTHER' THEN 1 ELSE 0 END) AS other_count, " +
                   "MAX(created_at) AS last_used " +
                   "FROM ai_usage_log WHERE created_at >= :since " +
                   "GROUP BY user_id ORDER BY total DESC LIMIT :limit", nativeQuery = true)
    List<Object[]> topUsersSince(@Param("since") LocalDateTime since, @Param("limit") int limit);
}
