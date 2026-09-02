package com.aza.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Range;
import org.springframework.data.redis.connection.Limit;
import org.springframework.data.redis.connection.RedisStreamCommands.XAddOptions;
import org.springframework.data.redis.connection.stream.MapRecord;
import org.springframework.data.redis.connection.stream.RecordId;
import org.springframework.data.redis.connection.stream.StreamRecords;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Durable per-user log of the real-time events we owe a client, backed by a
 * Redis Stream at {@code aza:events:<userId>}.
 *
 * <p>Why this exists: chat events were fanned out over Redis pub/sub only, which
 * is fire-and-forget. Anything published while a phone was backgrounded, off
 * network, or mid-reconnect was simply gone, and the client's only recovery was
 * {@code resyncActiveThread()} — a REST re-fetch of the one open conversation.
 * Messages in every other chat, read receipts and edits stayed invisible until
 * the screen was remounted.
 *
 * <p>Pub/sub is still the live transport: it is the lowest-latency way to reach
 * whichever instance holds the socket, and swapping it for a blocking XREAD per
 * connected user would cost one Redis connection and one thread per user. The
 * stream sits behind it as the recovery log — every durable event is appended
 * here first, the entry id travels with the event as its {@code id}, and the
 * client replays from the last id it saw. Delivery is therefore at-least-once:
 * a replay can overlap events already received live, and clients dedupe on id.
 *
 * <p>Retention is bounded twice over — {@code MAXLEN ~} caps entries per user and
 * a TTL expires idle streams — because this is a recovery buffer, not storage.
 * Postgres remains the source of truth, and a client that has fallen further
 * behind than the buffer holds is told to do a full resync instead.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WebSocketEventLog {

    public static final String STREAM_KEY_PREFIX = "aza:events:";

    /** Stream field holding the STOMP queue this event belongs to, e.g. "chat". */
    private static final String FIELD_DEST = "dest";
    /** Stream field holding the serialized WebSocketMessage, without its id. */
    private static final String FIELD_DATA = "data";

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    @Value("${app.websocket.event-log.enabled:true}")
    private boolean enabled;

    /**
     * Entries retained per user. Trimming is approximate (MAXLEN ~), so Redis may
     * keep somewhat more; it only ever drops from the old end.
     */
    @Value("${app.websocket.event-log.max-entries:500}")
    private long maxEntries;

    /** Idle-stream expiry, refreshed on every append. */
    @Value("${app.websocket.event-log.ttl-seconds:172800}")
    private long ttlSeconds;

    /** Maximum events returned by one replay before we ask the client to full-sync. */
    @Value("${app.websocket.event-log.replay-limit:200}")
    private int replayLimit;

    /**
     * Append a durable event to a user's log.
     *
     * @return the stream entry id to stamp on the event, or null if the log is
     *         disabled or the append failed — callers still deliver the event
     *         live, they just deliver it without a replayable cursor.
     */
    public String append(UUID userId, String dest, String json) {
        if (!enabled) {
            return null;
        }
        try {
            String key = key(userId);
            MapRecord<String, String, String> record = StreamRecords.newRecord()
                    .in(key)
                    .ofMap(Map.of(FIELD_DEST, dest, FIELD_DATA, json));

            RecordId id = redisTemplate.opsForStream().add(
                    record, XAddOptions.maxlen(maxEntries).approximateTrimming(true));

            // Refreshed on every append rather than set once at creation: the
            // stream should outlive the user's longest expected offline stretch,
            // measured from their last event, not from the stream's birth.
            redisTemplate.expire(key, Duration.ofSeconds(ttlSeconds));

            return id != null ? id.getValue() : null;
        } catch (Exception e) {
            // Never fail a send because the recovery buffer is unavailable —
            // the message is already committed to Postgres by this point.
            log.error("Failed to append event to log for user {}: {}", userId, e.getMessage());
            return null;
        }
    }

    /**
     * Everything appended to {@code userId}'s log after {@code cursor} for one
     * destination queue.
     */
    public Replay replay(UUID userId, String dest, String cursor) {
        // With the log off there is nothing to replay from, and silently
        // replaying nothing would leave the client believing it is up to date.
        // Report a gap so it falls back to the REST history — the behavior
        // this log replaced.
        if (!enabled) {
            return Replay.gap(null);
        }
        String key = key(userId);
        if (cursor == null || cursor.isBlank()) {
            // No cursor: either a fresh install or a client that has not yet
            // received a durable event. We cannot tell what it has seen, so
            // send it to the REST history and start it from the current tip.
            return Replay.gap(tip(key));
        }
        try {
            // A cursor older than the oldest retained entry means the gap is
            // wider than the buffer: we cannot know what was dropped, so the
            // client must reload from Postgres rather than be handed a
            // silently incomplete replay.
            List<MapRecord<String, Object, Object>> oldest = redisTemplate.opsForStream()
                    .range(key, Range.unbounded(), Limit.limit().count(1));
            if (oldest == null || oldest.isEmpty()) {
                // The stream expired or was never written: anything published
                // before now is unrecoverable from here.
                return Replay.gap(null);
            }
            if (compareIds(cursor, oldest.getFirst().getId().getValue()) < 0) {
                return Replay.gap(tip(key));
            }

            List<MapRecord<String, Object, Object>> records = redisTemplate.opsForStream().range(
                    key,
                    Range.of(Range.Bound.exclusive(cursor), Range.Bound.unbounded()),
                    // One over the limit, so a full page tells us there is more
                    // behind it without a second round trip.
                    Limit.limit().count(replayLimit + 1));

            if (records == null || records.isEmpty()) {
                return Replay.empty();
            }
            if (records.size() > replayLimit) {
                return Replay.gap(tip(key));
            }

            List<String> events = new ArrayList<>(records.size());
            for (MapRecord<String, Object, Object> record : records) {
                Map<Object, Object> value = record.getValue();
                if (!dest.equals(String.valueOf(value.get(FIELD_DEST)))) {
                    continue;
                }
                String json = stampId(String.valueOf(value.get(FIELD_DATA)), record.getId().getValue());
                if (json != null) {
                    events.add(json);
                }
            }
            return new Replay(events, false, null);
        } catch (Exception e) {
            // Fall back to a full sync rather than leaving the client on a
            // cursor whose gap we could not measure.
            log.error("Failed to replay event log for user {}: {}", userId, e.getMessage());
            return Replay.gap(null);
        }
    }

    /** Id of the newest entry in a stream, or null if it is empty or unreadable. */
    private String tip(String key) {
        try {
            List<MapRecord<String, Object, Object>> newest = redisTemplate.opsForStream()
                    .reverseRange(key, Range.unbounded(), Limit.limit().count(1));
            return newest == null || newest.isEmpty() ? null : newest.getFirst().getId().getValue();
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Put the stream entry id into the stored event as its {@code id} field. It
     * is not stored inline because it does not exist until XADD has returned.
     */
    private String stampId(String json, String id) {
        try {
            ObjectNode node = (ObjectNode) objectMapper.readTree(json);
            node.put("id", id);
            return objectMapper.writeValueAsString(node);
        } catch (Exception e) {
            log.warn("Dropping unparseable logged event {}: {}", id, e.getMessage());
            return null;
        }
    }

    /**
     * Order two stream ids ("&lt;millis&gt;-&lt;seq&gt;"). Both halves are numeric and
     * unbounded in width, so they compare as longs, not as strings —
     * "9-0" is older than "10-0" but sorts after it lexicographically.
     */
    private int compareIds(String left, String right) {
        long[] l = parseId(left);
        long[] r = parseId(right);
        int byTime = Long.compare(l[0], r[0]);
        return byTime != 0 ? byTime : Long.compare(l[1], r[1]);
    }

    private long[] parseId(String id) {
        int dash = id.indexOf('-');
        if (dash < 0) {
            return new long[]{Long.parseLong(id.trim()), 0L};
        }
        return new long[]{
                Long.parseLong(id.substring(0, dash).trim()),
                Long.parseLong(id.substring(dash + 1).trim())
        };
    }

    private String key(UUID userId) {
        return STREAM_KEY_PREFIX + userId;
    }

    /**
     * @param events events after the client's cursor, oldest first
     * @param gap    true when the replay could not be completed and the client
     *               must reload from the REST history instead
     * @param tip    on a gap, the newest entry id in the log — the cursor the
     *               client should adopt once it has reloaded, so the same gap
     *               is not reported again on every reconnect. Null otherwise.
     */
    public record Replay(List<String> events, boolean gap, String tip) {

        static Replay empty() {
            return new Replay(List.of(), false, null);
        }

        static Replay gap(String tip) {
            return new Replay(List.of(), true, tip);
        }
    }
}
