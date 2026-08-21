package com.aza.backend.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Runs work only once the surrounding transaction has committed.
 *
 * <p>An external side effect fired from inside a transaction — a push, an SMS, an email,
 * a WebSocket event, a webhook — has already left the building by the time that
 * transaction rolls back. The result is a recipient who is told about money that never
 * arrived. Deferring the effect to {@code afterCommit} makes the notification depend on
 * the money actually having moved.
 *
 * <p>It also keeps network I/O out of the transaction window. Four provider calls made
 * before commit hold the wallet rows locked for as long as those calls take, which
 * needlessly serialises every other transfer touching the same wallets.
 *
 * <p>When no transaction is active the action runs immediately, so callers behave the
 * same whether or not they were invoked inside one. A failure in the deferred action is
 * logged and swallowed: the money has already moved and the transaction is closed, so
 * throwing here would achieve nothing except an error the caller cannot act on.
 */
@Component
@Slf4j
public class AfterCommitExecutor {

    public void run(Runnable action) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            execute(action);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                execute(action);
            }
        });
    }

    private void execute(Runnable action) {
        try {
            action.run();
        } catch (Exception e) {
            log.error("Post-commit action failed: {}", e.getMessage(), e);
        }
    }
}
