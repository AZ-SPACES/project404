package com.aza.backend.integration;

import com.aza.backend.entity.User;
import com.aza.backend.entity.Wallet;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.repository.WalletRepository;
import com.aza.backend.service.WalletLocker;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/**
 * The double-spend experiment.
 *
 * <p>Pessimistic row locking is easy to assert in prose and hard to demonstrate. H2 and
 * Mockito cannot: one does not implement {@code SELECT ... FOR UPDATE} the way PostgreSQL
 * does, and the other never contends for anything. This class runs genuinely parallel
 * debits against a real database and checks the arithmetic afterwards, which is the only
 * form of evidence that actually settles the question.
 *
 * <p>Each test drives the wallet through the same repository lock finders the money path
 * uses, rather than through {@code TransferService}, so what is under test is the locking
 * discipline itself — not the twenty other rules a full transfer applies.
 */
class ConcurrentTransferIT extends PostgresIntegrationTest {

    @Autowired WalletRepository walletRepository;
    @Autowired UserRepository userRepository;
    @Autowired TransactionTemplate transactionTemplate;
    @Autowired WalletLocker walletLocker;

    private UUID aliceId;
    private UUID bobId;

    @BeforeEach
    void seedWallets() {
        aliceId = newUserWithWallet("alice", new BigDecimal("50.00"));
        bobId = newUserWithWallet("bob", new BigDecimal("50.00"));
    }

    @Test
    @DisplayName("100 parallel GHS 1 debits from a GHS 50 wallet: exactly 50 succeed, balance lands on 0")
    void concurrentDebits_neverOverdraw() throws Exception {
        int attempts = 100;
        BigDecimal each = new BigDecimal("1.00");

        AtomicInteger succeeded = new AtomicInteger();
        AtomicInteger rejected = new AtomicInteger();
        AtomicInteger errored = new AtomicInteger();

        runInParallel(attempts, () -> {
            try {
                boolean ok = Boolean.TRUE.equals(transactionTemplate.execute(status -> {
                    Wallet w = walletRepository.findByUserIdForUpdate(aliceId).orElseThrow();
                    if (w.getBalance().compareTo(each) < 0) {
                        return false;               // insufficient funds — the correct rejection
                    }
                    w.setBalance(w.getBalance().subtract(each));
                    walletRepository.saveAndFlush(w);
                    return true;
                }));
                (ok ? succeeded : rejected).incrementAndGet();
            } catch (Exception e) {
                errored.incrementAndGet();
            }
        });

        BigDecimal finalBalance = walletRepository.findByUserId(aliceId).orElseThrow().getBalance();

        assertEquals(0, errored.get(),
                "no debit should fail with an error — rejection is a business outcome, not an exception");
        assertEquals(50, succeeded.get(),
                "exactly the 50 debits the balance can fund should succeed");
        assertEquals(50, rejected.get(),
                "the other 50 should be rejected for insufficient funds");
        assertEquals(0, finalBalance.compareTo(BigDecimal.ZERO),
                "final balance must be exactly 0, not negative and not partially spent — got " + finalBalance);
    }

    @Test
    @DisplayName("A wallet can never be driven negative, whatever the interleaving")
    void concurrentDebits_neverProduceANegativeBalance() throws Exception {
        // Deliberately oversubscribed: 40 threads each trying to take more than a third
        // of the balance. Read-modify-write in Java would let several pass the check on
        // the same stale read.
        BigDecimal each = new BigDecimal("20.00");

        runInParallel(40, () -> {
            try {
                transactionTemplate.execute(status -> {
                    Wallet w = walletRepository.findByUserIdForUpdate(aliceId).orElseThrow();
                    if (w.getBalance().compareTo(each) >= 0) {
                        w.setBalance(w.getBalance().subtract(each));
                        walletRepository.saveAndFlush(w);
                    }
                    return null;
                });
            } catch (Exception ignored) {
                // Contention failures are acceptable here; a negative balance is not.
            }
        });

        BigDecimal finalBalance = walletRepository.findByUserId(aliceId).orElseThrow().getBalance();
        assertTrue(finalBalance.signum() >= 0, "balance went negative: " + finalBalance);
        // 50 funds exactly two withdrawals of 20; the 10 left cannot fund a third.
        assertEquals(0, finalBalance.compareTo(new BigDecimal("10.00")),
                "expected exactly two withdrawals to succeed, leaving 10 — got " + finalBalance);
    }

    @Test
    @DisplayName("Transfers in opposite directions between the same pair do not deadlock")
    void bidirectionalTransfers_doNotDeadlock() throws Exception {
        // This is the regression test for the lock-ordering finding. Before WalletLocker,
        // A→B locked A then B while B→A locked B then A, and PostgreSQL broke the cycle by
        // aborting one of them with SQLSTATE 40P01. Locking lowest-key-first removes the
        // cycle, so both directions merely queue.
        int rounds = 60;
        BigDecimal amount = new BigDecimal("1.00");
        AtomicInteger deadlocks = new AtomicInteger();

        List<Runnable> work = new java.util.ArrayList<>();
        for (int i = 0; i < rounds; i++) {
            boolean aToB = i % 2 == 0;
            UUID from = aToB ? aliceId : bobId;
            UUID to = aToB ? bobId : aliceId;
            work.add(() -> {
                try {
                    transactionTemplate.execute(status -> {
                        WalletLocker.Locked locked = walletLocker.lock(
                                WalletLocker.personal(from, "from wallet missing"),
                                WalletLocker.personal(to, "to wallet missing"));
                        Wallet fromWallet = locked.first();
                        Wallet toWallet = locked.second();
                        if (fromWallet.getBalance().compareTo(amount) >= 0) {
                            fromWallet.setBalance(fromWallet.getBalance().subtract(amount));
                            toWallet.setBalance(toWallet.getBalance().add(amount));
                            walletRepository.saveAndFlush(fromWallet);
                            walletRepository.saveAndFlush(toWallet);
                        }
                        return null;
                    });
                } catch (Exception e) {
                    if (isDeadlock(e)) deadlocks.incrementAndGet();
                }
            });
        }

        runAllInParallel(work);

        assertEquals(0, deadlocks.get(),
                "canonical lock ordering must make a deadlock cycle impossible");

        // And the money is conserved: whatever moved, the pair still holds 100 between them.
        BigDecimal total = walletRepository.findByUserId(aliceId).orElseThrow().getBalance()
                .add(walletRepository.findByUserId(bobId).orElseThrow().getBalance());
        assertEquals(0, total.compareTo(new BigDecimal("100.00")),
                "value was created or destroyed under contention — total is " + total);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private static boolean isDeadlock(Throwable e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof java.sql.SQLException sql && "40P01".equals(sql.getSQLState())) return true;
            String msg = t.getMessage();
            if (msg != null && msg.toLowerCase().contains("deadlock")) return true;
        }
        return false;
    }

    private void runInParallel(int times, Runnable action) throws Exception {
        runAllInParallel(java.util.stream.IntStream.range(0, times)
                .mapToObj(i -> action).map(r -> (Runnable) r).toList());
    }

    /**
     * Releases every task at the same instant via a start latch, so the threads genuinely
     * contend instead of trickling through one at a time as the pool warms up.
     */
    private void runAllInParallel(List<Runnable> tasks) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(Math.min(tasks.size(), 32));
        CountDownLatch start = new CountDownLatch(1);
        CountDownLatch done = new CountDownLatch(tasks.size());
        try {
            for (Runnable task : tasks) {
                pool.submit(() -> {
                    try {
                        start.await();
                        task.run();
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    } finally {
                        done.countDown();
                    }
                });
            }
            start.countDown();
            assertTrue(done.await(60, TimeUnit.SECONDS), "parallel work did not finish in time");
        } finally {
            pool.shutdownNow();
        }
    }

    private UUID newUserWithWallet(String handle, BigDecimal balance) {
        return transactionTemplate.execute(status -> {
            String unique = handle + "-" + UUID.randomUUID();
            User user = userRepository.saveAndFlush(User.builder()
                    .firstName(handle).lastName("Test")
                    .email(unique + "@example.com")
                    .phoneNumber("+2335" + Math.abs(unique.hashCode() % 100_000_000))
                    .username(unique)
                    .passwordHash("x")
                    .dateOfBirth(LocalDate.of(1995, 1, 1))
                    .status(User.AccountStatus.ACTIVE)
                    .balance(balance)
                    .build());
            walletRepository.saveAndFlush(Wallet.builder()
                    .userId(user.getId())
                    .type(Wallet.WalletType.PERSONAL)
                    .balance(balance)
                    .currency("GHS")
                    .frozen(false)
                    .build());
            return user.getId();
        });
    }
}
