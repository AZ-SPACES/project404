package com.aza.backend.service;

import com.aza.backend.entity.User;
import com.aza.backend.entity.UserWithdrawal;
import com.aza.backend.entity.Wallet;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.repository.UserWithdrawalRepository;
import com.aza.backend.repository.WalletRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
class UserWithdrawalServiceTest {

    @Autowired UserWithdrawalService service;

    @MockitoBean UserWithdrawalRepository withdrawalRepository;
    @MockitoBean WalletRepository walletRepository;
    @MockitoBean UserRepository userRepository;
    @MockitoBean UserService userService;
    @MockitoBean NotificationService notificationService;
    @MockitoBean StringRedisTemplate stringRedisTemplate;
    @MockitoBean RedisMessageListenerContainer redisMessageListenerContainer;

    private User user(UUID id, BigDecimal balance) {
        return User.builder().id(id).balance(balance).build();
    }

    private Wallet wallet(UUID userId, BigDecimal balance, boolean frozen) {
        Wallet w = new Wallet();
        w.setUserId(userId);
        w.setBalance(balance);
        w.setFrozen(frozen);
        return w;
    }

    private void echoSavedWithdrawal() {
        when(withdrawalRepository.save(any(UserWithdrawal.class)))
                .thenAnswer(inv -> inv.getArgument(0));
    }

    // ── request: reserves funds ────────────────────────────────────────────────

    @Test
    void request_reservesFundsAndCreatesPending() {
        UUID uid = UUID.randomUUID();
        User u = user(uid, new BigDecimal("100"));
        Wallet w = wallet(uid, new BigDecimal("100"), false);
        when(walletRepository.findByUserIdForUpdate(uid)).thenReturn(Optional.of(w));
        echoSavedWithdrawal();

        UserWithdrawal result = service.request(u, new BigDecimal("60"), "MTN", "024", null, "1234");

        assertEquals(0, new BigDecimal("40").compareTo(w.getBalance()), "wallet debited");
        assertEquals(0, new BigDecimal("40").compareTo(u.getBalance()), "user balance mirror updated");
        assertEquals(UserWithdrawal.WithdrawalStatus.PENDING, result.getStatus());
        verify(walletRepository).save(w);
        verify(userRepository).save(u);
        verify(userService).verifyPasscode(u, "1234");
    }

    @Test
    void request_insufficientBalance_throwsAndDoesNotDebit() {
        UUID uid = UUID.randomUUID();
        User u = user(uid, new BigDecimal("50"));
        Wallet w = wallet(uid, new BigDecimal("50"), false);
        when(walletRepository.findByUserIdForUpdate(uid)).thenReturn(Optional.of(w));

        AppException ex = assertThrows(AppException.class,
                () -> service.request(u, new BigDecimal("80"), "MTN", "024", null, "1234"));
        assertTrue(ex.getMessage().toLowerCase().contains("insufficient"));
        assertEquals(0, new BigDecimal("50").compareTo(w.getBalance()), "balance untouched");
        verify(walletRepository, never()).save(any());
        verify(withdrawalRepository, never()).save(any());
    }

    @Test
    void request_frozenWallet_throws() {
        UUID uid = UUID.randomUUID();
        User u = user(uid, new BigDecimal("100"));
        Wallet w = wallet(uid, new BigDecimal("100"), true);
        when(walletRepository.findByUserIdForUpdate(uid)).thenReturn(Optional.of(w));

        AppException ex = assertThrows(AppException.class,
                () -> service.request(u, new BigDecimal("10"), "MTN", "024", null, "1234"));
        assertTrue(ex.getMessage().toLowerCase().contains("frozen"));
        verify(walletRepository, never()).save(any());
    }

    // ── review: approve does not double-debit, reject refunds ───────────────────

    private UserWithdrawal pending(UUID uid, BigDecimal amount) {
        return UserWithdrawal.builder()
                .id(UUID.randomUUID())
                .userId(uid)
                .amount(amount)
                .status(UserWithdrawal.WithdrawalStatus.PENDING)
                .build();
    }

    @Test
    void review_approve_doesNotTouchWallet() {
        UUID uid = UUID.randomUUID();
        UserWithdrawal wd = pending(uid, new BigDecimal("60"));
        when(withdrawalRepository.findById(wd.getId())).thenReturn(Optional.of(wd));
        echoSavedWithdrawal();

        UserWithdrawal result = service.review(user(UUID.randomUUID(), BigDecimal.ZERO), wd.getId(), "APPROVE", "ok");

        assertEquals(UserWithdrawal.WithdrawalStatus.APPROVED, result.getStatus());
        // Funds were reserved at request time, so approval must NOT debit again.
        verify(walletRepository, never()).findByUserIdForUpdate(any());
        verify(walletRepository, never()).save(any());
    }

    @Test
    void review_reject_refundsReservedFunds() {
        UUID uid = UUID.randomUUID();
        UserWithdrawal wd = pending(uid, new BigDecimal("60"));
        User u = user(uid, new BigDecimal("40"));
        Wallet w = wallet(uid, new BigDecimal("40"), false); // already debited at request time
        when(withdrawalRepository.findById(wd.getId())).thenReturn(Optional.of(wd));
        when(walletRepository.findByUserIdForUpdate(uid)).thenReturn(Optional.of(w));
        when(userRepository.findById(uid)).thenReturn(Optional.of(u));
        echoSavedWithdrawal();

        UserWithdrawal result = service.review(user(UUID.randomUUID(), BigDecimal.ZERO), wd.getId(), "REJECT", "no");

        assertEquals(UserWithdrawal.WithdrawalStatus.REJECTED, result.getStatus());
        assertEquals(0, new BigDecimal("100").compareTo(w.getBalance()), "reserved funds refunded");
        assertEquals(0, new BigDecimal("100").compareTo(u.getBalance()), "user balance mirror refunded");
    }

    @Test
    void review_alreadyReviewed_throws() {
        UserWithdrawal wd = UserWithdrawal.builder()
                .id(UUID.randomUUID())
                .userId(UUID.randomUUID())
                .amount(new BigDecimal("10"))
                .status(UserWithdrawal.WithdrawalStatus.APPROVED)
                .build();
        when(withdrawalRepository.findById(wd.getId())).thenReturn(Optional.of(wd));

        AppException ex = assertThrows(AppException.class,
                () -> service.review(user(UUID.randomUUID(), BigDecimal.ZERO), wd.getId(), "APPROVE", null));
        assertTrue(ex.getMessage().toLowerCase().contains("already"));
    }
}
