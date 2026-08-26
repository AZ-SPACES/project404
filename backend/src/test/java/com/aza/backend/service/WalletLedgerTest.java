package com.aza.backend.service;

import com.aza.backend.entity.Transaction;
import com.aza.backend.entity.Wallet;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.TransactionRepository;
import com.aza.backend.repository.WalletRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Every wallet balance in the platform now moves through this class, so its arithmetic and
 * its refusals are worth pinning down directly rather than only through the twenty callers.
 *
 * <p>What the unit tests can settle is the arithmetic, the guards, and that the audit row
 * is written in the same call as the balance change. What they cannot settle is whether the
 * row lock actually serialises anything — that needs a real PostgreSQL under real
 * concurrency, which is {@code ConcurrentTransferIT}'s job.
 */
class WalletLedgerTest {

    private final WalletRepository walletRepository = mock(WalletRepository.class);
    private final TransactionRepository transactionRepository = mock(TransactionRepository.class);
    private final WalletLocker walletLocker = new WalletLocker(walletRepository);
    private final WalletLedger ledger =
            new WalletLedger(walletRepository, walletLocker, transactionRepository);

    private static final UUID FROM_USER = UUID.randomUUID();
    private static final UUID TO_USER = UUID.randomUUID();

    private static Wallet wallet(String balance) {
        return Wallet.builder().id(UUID.randomUUID()).userId(UUID.randomUUID())
                .type(Wallet.WalletType.PERSONAL).balance(new BigDecimal(balance))
                .currency("GHS").frozen(false).build();
    }

    private void echoSaves() {
        when(walletRepository.save(any(Wallet.class))).thenAnswer(i -> i.getArgument(0));
        when(transactionRepository.save(any(Transaction.class))).thenAnswer(i -> i.getArgument(0));
    }

    // ==================== single-sided ====================

    @Test
    void creditLocked_addsAndSaves() {
        echoSaves();
        Wallet w = wallet("100.00");

        ledger.creditLocked(w, new BigDecimal("25.50"));

        assertEquals(0, new BigDecimal("125.50").compareTo(w.getBalance()));
        verify(walletRepository).save(w);
    }

    @Test
    void debitLocked_subtractsAndSaves() {
        echoSaves();
        Wallet w = wallet("100.00");

        ledger.debitLocked(w, new BigDecimal("40.00"));

        assertEquals(0, new BigDecimal("60.00").compareTo(w.getBalance()));
        verify(walletRepository).save(w);
    }

    @Test
    void debitLocked_toExactlyZero_isAllowed() {
        echoSaves();
        Wallet w = wallet("40.00");

        ledger.debitLocked(w, new BigDecimal("40.00"));

        assertEquals(0, BigDecimal.ZERO.compareTo(w.getBalance()));
    }

    @Test
    void debitLocked_refusesOverdraw_andDoesNotSave() {
        Wallet w = wallet("30.00");

        AppException e = assertThrows(AppException.class,
                () -> ledger.debitLocked(w, new BigDecimal("30.01")));

        assertEquals("INSUFFICIENT_FUNDS", e.getCode());
        assertEquals(0, new BigDecimal("30.00").compareTo(w.getBalance()), "balance untouched");
        verify(walletRepository, never()).save(any(Wallet.class));
    }

    @Test
    void credit_locksTheRowItIsAbout() {
        echoSaves();
        Wallet w = wallet("10.00");
        when(walletRepository.findByUserIdForUpdate(FROM_USER)).thenReturn(Optional.of(w));

        ledger.credit(WalletLocker.personal(FROM_USER, "missing"), new BigDecimal("5.00"));

        // The locking finder, not the plain one — this is the whole point of the class.
        verify(walletRepository).findByUserIdForUpdate(FROM_USER);
        verify(walletRepository, never()).findByUserId(FROM_USER);
        assertEquals(0, new BigDecimal("15.00").compareTo(w.getBalance()));
    }

    // ==================== amount guards ====================

    @Test
    void refusesZeroAndNegativeAmounts() {
        Wallet w = wallet("100.00");
        for (String bad : new String[]{"0", "0.00", "-1.00"}) {
            AppException e = assertThrows(AppException.class,
                    () -> ledger.creditLocked(w, new BigDecimal(bad)), bad);
            assertEquals("INVALID_AMOUNT", e.getCode(), bad);
        }
        assertThrows(AppException.class, () -> ledger.creditLocked(w, null));
        assertEquals(0, new BigDecimal("100.00").compareTo(w.getBalance()));
    }

    @Test
    void refusesNegativeFee() {
        Wallet from = wallet("100.00");
        Wallet to = wallet("0.00");

        AppException e = assertThrows(AppException.class, () -> ledger.transferLocked(
                from, to, new BigDecimal("10.00"), new BigDecimal("-1.00"), null));

        assertEquals("INVALID_AMOUNT", e.getCode());
    }

    @Test
    void refusesTransferToTheSameWallet() {
        Wallet w = wallet("100.00");

        AppException e = assertThrows(AppException.class,
                () -> ledger.transferLocked(w, w, new BigDecimal("10.00"), BigDecimal.ZERO, null));

        assertEquals("INVALID_RECIPIENT", e.getCode());
    }

    // ==================== two-sided ====================

    @Test
    void transferLocked_senderPaysAmountPlusFee_recipientReceivesAmountOnly() {
        echoSaves();
        Wallet from = wallet("100.00");
        Wallet to = wallet("10.00");

        ledger.transferLocked(from, to, new BigDecimal("50.00"), new BigDecimal("0.25"), null);

        // The fee leaves circulation: it is debited but credited to nobody.
        assertEquals(0, new BigDecimal("49.75").compareTo(from.getBalance()), "sender pays amount + fee");
        assertEquals(0, new BigDecimal("60.00").compareTo(to.getBalance()), "recipient receives amount");
    }

    @Test
    void transferLocked_checksFundsAgainstAmountPlusFee_notAmountAlone() {
        Wallet from = wallet("50.00");
        Wallet to = wallet("0.00");

        AppException e = assertThrows(AppException.class, () -> ledger.transferLocked(
                from, to, new BigDecimal("50.00"), new BigDecimal("0.25"), null));

        assertEquals("INSUFFICIENT_FUNDS", e.getCode());
        assertEquals(0, new BigDecimal("50.00").compareTo(from.getBalance()), "sender untouched");
        assertEquals(0, BigDecimal.ZERO.compareTo(to.getBalance()), "recipient untouched");
        verify(walletRepository, never()).save(any(Wallet.class));
    }

    @Test
    void transferLocked_stampsAndSavesTheTransaction() {
        echoSaves();
        Wallet from = wallet("100.00");
        Wallet to = wallet("0.00");
        Transaction txn = Transaction.builder()
                .senderId(FROM_USER).recipientId(TO_USER)
                .amount(new BigDecimal("50.00"))
                .status(Transaction.TransactionStatus.PENDING)
                .build();

        ledger.transferLocked(from, to, new BigDecimal("50.00"), new BigDecimal("0.25"), txn);

        assertEquals(Transaction.TransactionStatus.COMPLETED, txn.getStatus());
        assertNotNull(txn.getCompletedAt());
        assertEquals(0, new BigDecimal("0.25").compareTo(txn.getFeeAmount()));
        verify(transactionRepository).save(txn);
    }

    @Test
    void transferLocked_writesNoTransactionWhenNoneIsGiven() {
        echoSaves();

        ledger.transferLocked(wallet("100.00"), wallet("0.00"),
                new BigDecimal("10.00"), BigDecimal.ZERO, null);

        // Float distribution, cash-in and the rest record themselves elsewhere.
        verify(transactionRepository, never()).save(any(Transaction.class));
    }

    @Test
    void transfer_locksBothWalletsBeforeMoving() {
        echoSaves();
        Wallet from = wallet("100.00");
        Wallet to = wallet("0.00");
        when(walletRepository.findByUserIdForUpdate(FROM_USER)).thenReturn(Optional.of(from));
        when(walletRepository.findByUserIdForUpdate(TO_USER)).thenReturn(Optional.of(to));

        ledger.transfer(
                WalletLocker.personal(FROM_USER, "missing"),
                WalletLocker.personal(TO_USER, "missing"),
                new BigDecimal("30.00"), BigDecimal.ZERO, null);

        verify(walletRepository).findByUserIdForUpdate(FROM_USER);
        verify(walletRepository).findByUserIdForUpdate(TO_USER);
        assertEquals(0, new BigDecimal("70.00").compareTo(from.getBalance()));
        assertEquals(0, new BigDecimal("30.00").compareTo(to.getBalance()));
    }

    @Test
    void transfer_returnsWalletsInTheOrderRequested_notTheOrderLocked() {
        echoSaves();
        Wallet from = wallet("100.00");
        Wallet to = wallet("0.00");
        when(walletRepository.findByUserIdForUpdate(FROM_USER)).thenReturn(Optional.of(from));
        when(walletRepository.findByUserIdForUpdate(TO_USER)).thenReturn(Optional.of(to));

        WalletLedger.Moved moved = ledger.transfer(
                WalletLocker.personal(FROM_USER, "missing"),
                WalletLocker.personal(TO_USER, "missing"),
                new BigDecimal("30.00"), BigDecimal.ZERO, null);

        assertSame(from, moved.from());
        assertSame(to, moved.to());
    }
}
