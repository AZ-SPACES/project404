package com.aza.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Range;
import org.springframework.data.redis.connection.Limit;
import org.springframework.data.redis.connection.RedisStreamCommands.XAddOptions;
import org.springframework.data.redis.connection.stream.MapRecord;
import org.springframework.data.redis.connection.stream.RecordId;
import org.springframework.data.redis.core.StreamOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
class WebSocketEventLogTest {

    @Autowired WebSocketEventLog eventLog;
    @Autowired ObjectMapper objectMapper;

    @MockitoBean StringRedisTemplate redisTemplate;
    @MockitoBean RedisMessageListenerContainer redisMessageListenerContainer;

    @SuppressWarnings("unchecked")
    private final StreamOperations<String, Object, Object> streamOps = mock(StreamOperations.class);

    private final UUID userId = UUID.randomUUID();
    private final String key = WebSocketEventLog.STREAM_KEY_PREFIX;

    @BeforeEach
    void setUp() {
        reset(redisTemplate, streamOps);
        when(redisTemplate.<Object, Object>opsForStream()).thenReturn(streamOps);
        ReflectionTestUtils.setField(eventLog, "enabled", true);
        ReflectionTestUtils.setField(eventLog, "maxEntries", 500L);
        ReflectionTestUtils.setField(eventLog, "ttlSeconds", 172800L);
        ReflectionTestUtils.setField(eventLog, "replayLimit", 200);
    }

    private String streamKey() {
        return key + userId;
    }

    private MapRecord<String, Object, Object> record(String id, String dest, String data) {
        return MapRecord.<String, Object, Object>create(streamKey(), Map.of("dest", dest, "data", data))
                .withId(RecordId.of(id));
    }

    @Test
    void appendReturnsEntryIdAndRefreshesTtl() {
        when(streamOps.add(any(MapRecord.class), any(XAddOptions.class)))
                .thenReturn(RecordId.of("1700000000000-0"));

        String id = eventLog.append(userId, "chat", "{\"type\":\"chat.message\"}");

        assertEquals("1700000000000-0", id);
        verify(redisTemplate).expire(streamKey(), Duration.ofSeconds(172800L));
    }

    @Test
    void appendSurvivesRedisFailureSoTheSendStillGoesOut() {
        when(streamOps.add(any(MapRecord.class), any(XAddOptions.class)))
                .thenThrow(new RuntimeException("redis down"));

        assertNull(eventLog.append(userId, "chat", "{\"type\":\"chat.message\"}"));
    }

    @Test
    void replayStampsEntryIdsOntoStoredEvents() throws Exception {
        String stored = "{\"type\":\"chat.message\",\"payload\":{\"chatId\":\"c1\"}}";
        when(streamOps.range(eq(streamKey()), any(Range.class), any(Limit.class)))
                .thenReturn(List.of(record("100-0", "chat", stored)))       // oldest probe
                .thenReturn(List.of(record("101-0", "chat", stored)));      // the replay itself

        WebSocketEventLog.Replay replay = eventLog.replay(userId, "chat", "100-0");

        assertFalse(replay.gap());
        assertEquals(1, replay.events().size());
        assertEquals("101-0", objectMapper.readTree(replay.events().getFirst()).get("id").asText());
    }

    @Test
    void replaySkipsEventsForOtherQueues() {
        String stored = "{\"type\":\"notification.new\"}";
        when(streamOps.range(eq(streamKey()), any(Range.class), any(Limit.class)))
                .thenReturn(List.of(record("100-0", "chat", stored)))
                .thenReturn(List.of(record("101-0", "notifications", stored)));

        WebSocketEventLog.Replay replay = eventLog.replay(userId, "chat", "100-0");

        assertFalse(replay.gap());
        assertTrue(replay.events().isEmpty());
    }

    @Test
    void cursorOlderThanTheRetainedLogReportsAGapWithTheCurrentTip() {
        // Ids compare numerically, not lexicographically: "9-0" is genuinely
        // older than "100-0" even though it sorts after it as a string.
        when(streamOps.range(eq(streamKey()), any(Range.class), any(Limit.class)))
                .thenReturn(List.of(record("100-0", "chat", "{}")));
        when(streamOps.reverseRange(eq(streamKey()), any(Range.class), any(Limit.class)))
                .thenReturn(List.of(record("400-0", "chat", "{}")));

        WebSocketEventLog.Replay replay = eventLog.replay(userId, "chat", "9-0");

        assertTrue(replay.gap());
        assertEquals("400-0", replay.tip());
        assertTrue(replay.events().isEmpty());
    }

    @Test
    void moreThanTheReplayLimitReportsAGapRatherThanAPartialReplay() {
        ReflectionTestUtils.setField(eventLog, "replayLimit", 2);
        when(streamOps.range(eq(streamKey()), any(Range.class), any(Limit.class)))
                .thenReturn(List.of(record("100-0", "chat", "{}")))
                .thenReturn(List.of(
                        record("101-0", "chat", "{}"),
                        record("102-0", "chat", "{}"),
                        record("103-0", "chat", "{}")));
        when(streamOps.reverseRange(eq(streamKey()), any(Range.class), any(Limit.class)))
                .thenReturn(List.of(record("103-0", "chat", "{}")));

        WebSocketEventLog.Replay replay = eventLog.replay(userId, "chat", "100-0");

        assertTrue(replay.gap());
        assertTrue(replay.events().isEmpty());
    }

    @Test
    void anExpiredStreamIsAGapNotAnEmptyReplay() {
        when(streamOps.range(eq(streamKey()), any(Range.class), any(Limit.class)))
                .thenReturn(List.of());

        assertTrue(eventLog.replay(userId, "chat", "100-0").gap());
    }

    @Test
    void nothingNewSinceTheCursorIsNotAGap() {
        when(streamOps.range(eq(streamKey()), any(Range.class), any(Limit.class)))
                .thenReturn(List.of(record("100-0", "chat", "{}")))
                .thenReturn(List.of());

        WebSocketEventLog.Replay replay = eventLog.replay(userId, "chat", "100-0");

        assertFalse(replay.gap());
        assertTrue(replay.events().isEmpty());
    }

    @Test
    void aMissingCursorAsksTheClientToFullSync() {
        when(streamOps.reverseRange(eq(streamKey()), any(Range.class), any(Limit.class)))
                .thenReturn(List.of(record("400-0", "chat", "{}")));

        WebSocketEventLog.Replay replay = eventLog.replay(userId, "chat", null);

        assertTrue(replay.gap());
        assertEquals("400-0", replay.tip());
    }

    @Test
    void disabledLogNeitherWritesNorSilentlyReportsSuccess() {
        ReflectionTestUtils.setField(eventLog, "enabled", false);

        assertNull(eventLog.append(userId, "chat", "{}"));
        assertTrue(eventLog.replay(userId, "chat", "100-0").gap());
        verifyNoInteractions(streamOps);
    }
}
