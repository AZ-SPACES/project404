package com.aza.backend.service;

import com.aza.backend.dto.user.UpdateProfileRequest;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * PUT /users/me must not be a side door around the OTP-verified email and phone
 * change flows — those identifiers are how an account is recovered.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
class UserServiceProfileTest {

    @Autowired UserService userService;

    @MockitoBean UserRepository userRepository;
    @MockitoBean StringRedisTemplate stringRedisTemplate;
    @MockitoBean RedisMessageListenerContainer redisMessageListenerContainer;

    private User user;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setId(UUID.randomUUID());
        user.setFirstName("Kofi");
        user.setLastName("Mensah");
        user.setEmail("kofi@gmail.com");
        user.setPhoneNumber("+233241234567");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void rejectsEmailChange() {
        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setEmail("someone.else@gmail.com");

        AppException ex = assertThrows(AppException.class, () -> userService.updateProfile(user, request));
        assertEquals("EMAIL_CHANGE_REQUIRES_VERIFICATION", ex.getCode());
        assertEquals("kofi@gmail.com", user.getEmail());
    }

    @Test
    void rejectsPhoneChange() {
        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setPhone("0209999999");

        AppException ex = assertThrows(AppException.class, () -> userService.updateProfile(user, request));
        assertEquals("PHONE_CHANGE_REQUIRES_VERIFICATION", ex.getCode());
        assertEquals("+233241234567", user.getPhoneNumber());
    }

    @Test
    void acceptsUnchangedIdentifiersInAnyFormat() {
        // Same address and same number, differently formatted — a client echoing the
        // profile back must not be told to go verify something that hasn't changed.
        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setEmail("Kofi@Gmail.com");
        request.setPhone("0241234567");
        request.setFirstName("Ama");

        assertDoesNotThrow(() -> userService.updateProfile(user, request));
        assertEquals("Ama", user.getFirstName());
        assertEquals("kofi@gmail.com", user.getEmail());
        assertEquals("+233241234567", user.getPhoneNumber());
    }

    @Test
    void neverLooksUpAnotherAccountToDecide() {
        // The old code allowed the change when existsByEmail said the value was free,
        // which is what made an unverified takeover of a recovery identifier possible.
        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setEmail("unclaimed@gmail.com");

        assertThrows(AppException.class, () -> userService.updateProfile(user, request));
        verify(userRepository, never()).existsByEmail(anyString());
    }
}
