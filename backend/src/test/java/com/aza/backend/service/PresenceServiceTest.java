package com.aza.backend.service;

import com.aza.backend.dto.user.PresenceResponse;
import com.aza.backend.dto.websocket.WebSocketEventType;
import com.aza.backend.entity.BlockedUser;
import com.aza.backend.entity.User;
import com.aza.backend.repository.BlockedUserRepository;
import com.aza.backend.repository.ChatRepository;
import com.aza.backend.repository.ContactRepository;
import com.aza.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.data.redis.core.SetOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
class PresenceServiceTest {

    @Autowired PresenceService presenceService;

    @MockitoBean StringRedisTemplate redisTemplate;
    @MockitoBean UserRepository userRepository;
    @MockitoBean ChatRepository chatRepository;
    @MockitoBean ContactRepository contactRepository;
    @MockitoBean BlockedUserRepository blockedUserRepository;
    @MockitoBean WebSocketPublisher webSocketPublisher;
    @MockitoBean RedisMessageListenerContainer redisMessageListenerContainer;

    @SuppressWarnings("unchecked")
    private final ValueOperations<String, String> valueOps = mock(ValueOperations.class);
    @SuppressWarnings("unchecked")
    private final SetOperations<String, String> setOps = mock(SetOperations.class);

    private final UUID userId    = UUID.randomUUID();
    private final UUID partnerId = UUID.randomUUID();
    private User user;
    private String userKey;
    private String connsKey;

    @BeforeEach
    void setUp() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(redisTemplate.opsForSet()).thenReturn(setOps);
        ReflectionTestUtils.setField(presenceService, "ttlSeconds", 65);

        user = User.builder().id(userId).build();
        userKey  = "presence:user:" + userId;
        connsKey = "presence:conns:" + userId;

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(chatRepository.findPartnerIds(userId)).thenReturn(List.of(partnerId));
        when(contactRepository.findOwnerUserIdsByContactUserId(userId)).thenReturn(List.of());
        when(blockedUserRepository.findAllInvolving(userId)).thenReturn(List.of());
    }

    // ── Connection lifecycle ───────────────────────────────────────────────

    @Test
    void firstConnection_marksOnlineAndNotifiesChatPartner() {
        when(redisTemplate.hasKey(userKey)).thenReturn(false);

        presenceService.connectionOpened(userId, "ws-1", "device-1");

        verify(setOps).add(connsKey, "ws-1");
        verify(valueOps).set(eq(userKey), eq("ONLINE"), any(java.time.Duration.class));
        assertEquals(User.OnlineStatus.ONLINE, user.getOnlineStatus());
        verify(userRepository).save(user);
        verify(webSocketPublisher).publishPresenceToUser(
                eq(partnerId), eq(WebSocketEventType.USER_ONLINE), any());
    }

    @Test
    void secondConnection_doesNotRepublishOnline() {
        when(redisTemplate.hasKey(userKey)).thenReturn(true);

        presenceService.connectionOpened(userId, "ws-2", "device-1");

        verify(webSocketPublisher, never()).publishPresenceToUser(any(), any(), any());
        verify(userRepository, never()).save(any());
    }

    @Test
    void closingOneOfTwoSockets_keepsUserOnline() {
        when(setOps.size(connsKey)).thenReturn(1L);

        presenceService.connectionClosed(userId, "ws-1", "device-1");

        verify(setOps).remove(connsKey, "ws-1");
        verify(redisTemplate, never()).delete(userKey);
        verify(webSocketPublisher, never()).publishPresenceToUser(
                any(), eq(WebSocketEventType.USER_OFFLINE), any());
    }

    @Test
    void closingLastSocket_marksOfflineAndPersistsLastSeen() {
        when(setOps.size(connsKey)).thenReturn(0L);
        when(valueOps.get("presence:lastseen:" + userId)).thenReturn("2026-06-11T10:00:00");

        presenceService.connectionClosed(userId, "ws-1", "device-1");

        verify(redisTemplate).delete("presence:device:device-1");
        verify(redisTemplate).delete(userKey);
        assertEquals(User.OnlineStatus.OFFLINE, user.getOnlineStatus());
        assertEquals(LocalDateTime.parse("2026-06-11T10:00:00"), user.getLastSeenAt());
        verify(userRepository).save(user);
        verify(webSocketPublisher).publishPresenceToUser(
                eq(partnerId), eq(WebSocketEventType.USER_OFFLINE), any());
    }

    @Test
    void heartbeat_afterTtlLapse_recoversOnlineState() {
        when(redisTemplate.hasKey(userKey)).thenReturn(false);

        presenceService.heartbeat(userId, "device-1");

        verify(valueOps).set(eq(userKey), eq("ONLINE"), any(java.time.Duration.class));
        verify(webSocketPublisher).publishPresenceToUser(
                eq(partnerId), eq(WebSocketEventType.USER_ONLINE), any());
    }

    @Test
    void heartbeat_whileOnline_justRefreshesTtls() {
        when(redisTemplate.hasKey(userKey)).thenReturn(true);

        presenceService.heartbeat(userId, "device-1");

        verify(valueOps).set(eq(userKey), eq("ONLINE"), any(java.time.Duration.class));
        verify(valueOps).set(eq("presence:device:device-1"), eq(userId.toString()),
                any(java.time.Duration.class));
        verify(webSocketPublisher, never()).publishPresenceToUser(any(), any(), any());
    }

    // ── Sweeper ────────────────────────────────────────────────────────────

    @Test
    void sweeper_flipsStaleOnlineUsersToOffline() {
        user.setOnlineStatus(User.OnlineStatus.ONLINE);
        when(userRepository.findAllByOnlineStatus(User.OnlineStatus.ONLINE)).thenReturn(List.of(user));
        when(redisTemplate.hasKey(userKey)).thenReturn(false);

        presenceService.sweepStalePresence();

        assertEquals(User.OnlineStatus.OFFLINE, user.getOnlineStatus());
        assertNotNull(user.getLastSeenAt());
        verify(userRepository).save(user);
        verify(webSocketPublisher).publishPresenceToUser(
                eq(partnerId), eq(WebSocketEventType.USER_OFFLINE), any());
    }

    @Test
    void sweeper_leavesGenuinelyOnlineUsersAlone() {
        user.setOnlineStatus(User.OnlineStatus.ONLINE);
        when(userRepository.findAllByOnlineStatus(User.OnlineStatus.ONLINE)).thenReturn(List.of(user));
        when(redisTemplate.hasKey(userKey)).thenReturn(true);

        presenceService.sweepStalePresence();

        assertEquals(User.OnlineStatus.ONLINE, user.getOnlineStatus());
        verify(userRepository, never()).save(any());
    }

    // ── Privacy ────────────────────────────────────────────────────────────

    @Test
    void hiddenStatus_suppressesFanOutEntirely() {
        user.setShowOnlineStatus(false);
        when(redisTemplate.hasKey(userKey)).thenReturn(false);

        presenceService.connectionOpened(userId, "ws-1", "device-1");

        verify(webSocketPublisher, never()).publishPresenceToUser(any(), any(), any());
        assertEquals(User.OnlineStatus.ONLINE, user.getOnlineStatus());
    }

    @Test
    void fanOut_excludesBlockedUsers() {
        UUID blockedPartner = UUID.randomUUID();
        when(chatRepository.findPartnerIds(userId)).thenReturn(List.of(partnerId, blockedPartner));
        when(blockedUserRepository.findAllInvolving(userId)).thenReturn(List.of(
                BlockedUser.builder().blockerId(blockedPartner).blockedUserId(userId).build()));
        when(redisTemplate.hasKey(userKey)).thenReturn(false);

        presenceService.connectionOpened(userId, "ws-1", "device-1");

        verify(webSocketPublisher).publishPresenceToUser(
                eq(partnerId), eq(WebSocketEventType.USER_ONLINE), any());
        verify(webSocketPublisher, never()).publishPresenceToUser(eq(blockedPartner), any(), any());
    }

    @Test
    void getPresenceFor_hidesStatusWhenToggledOff() {
        user.setShowOnlineStatus(false);
        user.setLastSeenAt(LocalDateTime.now());

        PresenceResponse response = presenceService.getPresenceFor(partnerId, user);

        assertEquals("OFFLINE", response.getStatus());
        assertNull(response.getLastSeenAt());
    }

    @Test
    void getPresenceFor_hidesStatusBetweenBlockedUsers() {
        when(blockedUserRepository.existsBlockBetween(partnerId, userId)).thenReturn(true);
        when(redisTemplate.hasKey(userKey)).thenReturn(true);

        PresenceResponse response = presenceService.getPresenceFor(partnerId, user);

        assertEquals("OFFLINE", response.getStatus());
        assertNull(response.getLastSeenAt());
    }

    @Test
    void getPresenceFor_selfAlwaysSeesOwnTruth() {
        user.setShowOnlineStatus(false);
        when(redisTemplate.hasKey(userKey)).thenReturn(true);

        PresenceResponse response = presenceService.getPresenceFor(userId, user);

        assertEquals("ONLINE", response.getStatus());
    }

    @Test
    void getPresenceBatch_capsRequestSize() {
        List<UUID> ids = java.util.stream.Stream.generate(UUID::randomUUID).limit(250).toList();
        when(userRepository.findAllById(anyList())).thenReturn(List.of());

        presenceService.getPresenceBatch(partnerId, ids);

        verify(userRepository).findAllById(argThat((List<UUID> capped) ->
                capped.size() == PresenceService.MAX_BATCH_SIZE));
    }
}
