package com.aza.backend.repository;

import com.aza.backend.entity.Transaction;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * The daily cap is only as good as the query behind it, and this one is the single place
 * every limit check asks "how much has this person sent today". It is JPQL, so nothing
 * about it is checked by the compiler or by the service tests, which mock it away.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
@Transactional
class DailySentTotalTest {

    @Autowired TransactionRepository transactionRepository;

    @MockitoBean StringRedisTemplate stringRedisTemplate;
    @MockitoBean RedisMessageListenerContainer redisMessageListenerContainer;

    private final UUID payer = UUID.randomUUID();
    private final UUID other = UUID.randomUUID();

    private LocalDateTime startOfDay;
    private LocalDateTime endOfDay;
    private LocalDateTime now;

    @BeforeEach
    void setUp() {
        now = LocalDateTime.now();
        startOfDay = LocalDate.now().atStartOfDay();
        endOfDay = startOfDay.plusDays(1);
    }

    private BigDecimal sentToday() {
        return transactionRepository.getTotalSentToday(payer, startOfDay, endOfDay, now);
    }

    // ── Transfers ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("a completed transfer counts")
    void completedTransferCounts() {
        transactionRepository.save(transfer("100.00", Transaction.TransactionStatus.COMPLETED, now));
        assertEquals(0, new BigDecimal("100.00").compareTo(sentToday()));
    }

    @Test
    @DisplayName("an unexpired pending transfer still holds against the cap")
    void pendingTransferCounts() {
        Transaction t = transfer("100.00", Transaction.TransactionStatus.PENDING, now);
        t.setExpiresAt(now.plusHours(1));
        transactionRepository.save(t);
        assertEquals(0, new BigDecimal("100.00").compareTo(sentToday()));
    }

    @Test
    @DisplayName("a declined transfer does not")
    void declinedTransferDoesNotCount() {
        transactionRepository.save(transfer("100.00", Transaction.TransactionStatus.DECLINED, now));
        assertEquals(0, BigDecimal.ZERO.compareTo(sentToday()));
    }

    // ── Money requests ────────────────────────────────────────────────────────

    /**
     * The leak this query used to have: accepted requests were typed REQUEST, the filter
     * only matched TRANSFER and MERCHANT_PAYMENT, so paying any number of them never
     * touched the ceiling. Bill splitting made it worse by minting a leg per person.
     */
    @Test
    @DisplayName("an accepted money request counts against the payer's cap")
    void acceptedRequestCounts() {
        Transaction t = request("2000.00", Transaction.TransactionStatus.COMPLETED);
        t.setCompletedAt(now);
        transactionRepository.save(t);
        assertEquals(0, new BigDecimal("2000.00").compareTo(sentToday()));
    }

    @Test
    @DisplayName("being asked is not spending — a pending request does not count")
    void pendingRequestDoesNotCount() {
        // A split can put thirty of these in front of someone at once. If merely being
        // asked consumed the cap, one split would lock a person out of their own money.
        for (int i = 0; i < 30; i++) {
            transactionRepository.save(request("500.00", Transaction.TransactionStatus.PENDING));
        }
        assertEquals(0, BigDecimal.ZERO.compareTo(sentToday()));
    }

    @Test
    @DisplayName("a request is counted on the day it was paid, not the day it was asked")
    void requestCountsOnTheDayItWasPaid() {
        // Asked last week, paid today: it belongs to today's ceiling, because today is
        // when the money actually left.
        Transaction t = request("300.00", Transaction.TransactionStatus.COMPLETED);
        t.setRequestedAt(now.minusDays(7));
        t.setCompletedAt(now);
        transactionRepository.save(t);
        assertEquals(0, new BigDecimal("300.00").compareTo(sentToday()));

        // Asked today, paid tomorrow: not today's problem yet.
        Transaction later = request("400.00", Transaction.TransactionStatus.COMPLETED);
        later.setCompletedAt(endOfDay.plusHours(2));
        transactionRepository.save(later);
        assertEquals(0, new BigDecimal("300.00").compareTo(sentToday()));
    }

    @Test
    @DisplayName("only this person's own sending counts")
    void someoneElsesSpendingIsNotCounted() {
        Transaction t = transfer("100.00", Transaction.TransactionStatus.COMPLETED, now);
        t.setSenderId(other);
        transactionRepository.save(t);
        assertEquals(0, BigDecimal.ZERO.compareTo(sentToday()));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Transaction transfer(String amount, Transaction.TransactionStatus status, LocalDateTime when) {
        Transaction t = Transaction.builder()
                .senderId(payer)
                .recipientId(other)
                .amount(new BigDecimal(amount))
                .type(Transaction.TransactionType.TRANSFER)
                .status(status)
                .build();
        if (status == Transaction.TransactionStatus.COMPLETED) t.setCompletedAt(when);
        return t;
    }

    private Transaction request(String amount, Transaction.TransactionStatus status) {
        return Transaction.builder()
                .senderId(payer)
                .recipientId(other)
                .amount(new BigDecimal(amount))
                .type(Transaction.TransactionType.REQUEST)
                .status(status)
                .isRequest(true)
                .requestedAt(now)
                .build();
    }
}
