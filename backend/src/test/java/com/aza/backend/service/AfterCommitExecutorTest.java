package com.aza.backend.service;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/**
 * The rule this enforces: a notification must never precede the commit of the money it
 * describes. Fired inside the transaction, a rollback would leave a recipient holding a
 * push, an SMS and an email for a transfer that never happened.
 */
class AfterCommitExecutorTest {

    private final AfterCommitExecutor executor = new AfterCommitExecutor();

    @AfterEach
    void clearSynchronization() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void runsImmediately_whenNoTransactionIsActive() {
        AtomicInteger runs = new AtomicInteger();

        executor.run(runs::incrementAndGet);

        // Callers behave the same whether or not they were invoked inside a transaction,
        // so a service method reused outside one still notifies.
        assertEquals(1, runs.get());
    }

    @Test
    void defersUntilCommit_whenATransactionIsActive() {
        TransactionSynchronizationManager.initSynchronization();
        AtomicInteger runs = new AtomicInteger();

        executor.run(runs::incrementAndGet);

        assertEquals(0, runs.get(), "must not fire while the transaction is still open");

        // Simulate the commit.
        TransactionSynchronizationManager.getSynchronizations()
                .forEach(s -> s.afterCommit());

        assertEquals(1, runs.get(), "must fire once the transaction has committed");
    }

    @Test
    void neverFires_whenTheTransactionRollsBack() {
        TransactionSynchronizationManager.initSynchronization();
        AtomicInteger runs = new AtomicInteger();

        executor.run(runs::incrementAndGet);

        // A rollback simply never invokes afterCommit — this is the whole point of the
        // component, and the failure mode it exists to prevent.
        TransactionSynchronizationManager.clearSynchronization();

        assertEquals(0, runs.get());
    }

    @Test
    void swallowsFailures_soAFailedNotificationCannotUndoACommittedTransfer() {
        AtomicInteger secondRan = new AtomicInteger();

        assertDoesNotThrow(() -> executor.run(() -> {
            throw new IllegalStateException("provider down");
        }));

        // And the executor stays usable afterwards.
        executor.run(secondRan::incrementAndGet);
        assertEquals(1, secondRan.get());
    }

    @Test
    void registersOneSynchronizationPerAction() {
        TransactionSynchronizationManager.initSynchronization();

        executor.run(() -> {});
        executor.run(() -> {});

        assertEquals(2, TransactionSynchronizationManager.getSynchronizations().size());
    }
}
