package com.aza.backend.service;

import com.aza.backend.entity.Wallet;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.WalletRepository;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * The property under test is deadlock avoidance: whichever way round a caller asks for
 * a pair of wallets, the locks are always acquired lowest-key-first. Two transfers in
 * opposite directions between the same people therefore queue behind each other instead
 * of forming a cycle.
 *
 * <p>This is asserted at the level the bug lives at — the order of the repository calls —
 * because the deadlock itself only manifests against a real database under real
 * concurrency, which no unit test can stage.
 */
class WalletLockerTest {

    private final WalletRepository walletRepository = mock(WalletRepository.class);
    private final WalletLocker locker = new WalletLocker(walletRepository);

    // Two ids named by where UUID.compareTo actually puts them — which is NOT byte order.
    // UUID.compareTo compares the high 64 bits as a *signed* long, so "ffffffff-..." sorts
    // before "00000000-...". That does not matter for deadlock avoidance (any total order
    // works, as long as every caller uses the same one), but naming these by the wrong
    // intuition would make the tests below assert the opposite of what they mean.
    private static final UUID ID_A = UUID.fromString("ffffffff-0000-0000-0000-00000000000f");
    private static final UUID ID_B = UUID.fromString("00000000-0000-0000-0000-00000000000a");
    private static final UUID LOWER  = ID_A.compareTo(ID_B) < 0 ? ID_A : ID_B;
    private static final UUID HIGHER = ID_A.compareTo(ID_B) < 0 ? ID_B : ID_A;

    @Test
    void uuidComparisonIsSigned_whichIsWhyOrderIsDerivedNotAssumed() {
        // Pins the quirk the constants above depend on. If a future JDK changed it, this
        // fails loudly rather than silently weakening every ordering test in this class.
        assertTrue(UUID.fromString("ffffffff-0000-0000-0000-000000000000")
                .compareTo(UUID.fromString("00000000-0000-0000-0000-000000000000")) < 0);
    }

    private Wallet personalWallet(UUID userId) {
        return Wallet.builder().userId(userId).type(Wallet.WalletType.PERSONAL)
                .balance(BigDecimal.ZERO).currency("GHS").frozen(false).build();
    }

    private void stubPersonal(UUID... userIds) {
        for (UUID id : userIds) {
            when(walletRepository.findByUserIdForUpdate(id)).thenReturn(Optional.of(personalWallet(id)));
        }
    }

    @Test
    void locksLowerIdFirst_whenAskedInAscendingOrder() {
        stubPersonal(LOWER, HIGHER);

        locker.lock(WalletLocker.personal(LOWER, "a"), WalletLocker.personal(HIGHER, "b"));

        InOrder inOrder = inOrder(walletRepository);
        inOrder.verify(walletRepository).findByUserIdForUpdate(LOWER);
        inOrder.verify(walletRepository).findByUserIdForUpdate(HIGHER);
    }

    @Test
    void locksLowerIdFirst_evenWhenAskedInDescendingOrder() {
        stubPersonal(LOWER, HIGHER);

        // The caller asks for (HIGHER, LOWER) — the reverse of the previous test. This is
        // the B→A transfer racing the A→B one; without canonical ordering the two would
        // take the locks in opposite orders and deadlock.
        locker.lock(WalletLocker.personal(HIGHER, "a"), WalletLocker.personal(LOWER, "b"));

        InOrder inOrder = inOrder(walletRepository);
        inOrder.verify(walletRepository).findByUserIdForUpdate(LOWER);
        inOrder.verify(walletRepository).findByUserIdForUpdate(HIGHER);
    }

    @Test
    void returnsWalletsInRequestedOrder_notAcquisitionOrder() {
        stubPersonal(LOWER, HIGHER);

        WalletLocker.Locked locked =
                locker.lock(WalletLocker.personal(HIGHER, "a"), WalletLocker.personal(LOWER, "b"));

        // Acquired lower-first, but handed back in the order the caller asked for, so
        // call sites never have to reason about which one was locked first.
        assertEquals(HIGHER, locked.first().getUserId());
        assertEquals(LOWER, locked.second().getUserId());
    }

    @Test
    void ordersByWalletType_whenBothWalletsBelongToTheSameUser() {
        UUID sameUser = LOWER;
        when(walletRepository.findByUserIdForUpdate(sameUser))
                .thenReturn(Optional.of(personalWallet(sameUser)));
        when(walletRepository.findByUserIdAndTypeForUpdate(sameUser, Wallet.WalletType.AGENT_FLOAT))
                .thenReturn(Optional.of(Wallet.builder().userId(sameUser)
                        .type(Wallet.WalletType.AGENT_FLOAT).balance(BigDecimal.ZERO).build()));

        // A user id alone does not identify a wallet — an agent holds both a PERSONAL and
        // an AGENT_FLOAT wallet, so the tiebreak has to be the type.
        locker.lock(WalletLocker.personal(sameUser, "a"), WalletLocker.agentFloat(sameUser, "b"));

        InOrder inOrder = inOrder(walletRepository);
        inOrder.verify(walletRepository).findByUserIdForUpdate(sameUser);
        inOrder.verify(walletRepository).findByUserIdAndTypeForUpdate(sameUser, Wallet.WalletType.AGENT_FLOAT);
    }

    @Test
    void orderingIsStableAcrossEveryPairingOfManyIds() {
        // A stronger statement than the two-id cases: for every ordered pair drawn from a
        // set of ids, the acquisition sequence depends only on the pair, never on the
        // order it was requested in. That total, caller-independent order is exactly what
        // makes a lock cycle impossible.
        List<UUID> ids = List.of(
                UUID.fromString("11111111-0000-0000-0000-000000000000"),
                UUID.fromString("22222222-0000-0000-0000-000000000000"),
                UUID.fromString("33333333-0000-0000-0000-000000000000"),
                UUID.fromString("44444444-0000-0000-0000-000000000000"));
        ids.forEach(id -> stubPersonal(id));

        for (UUID a : ids) {
            for (UUID b : ids) {
                if (a.equals(b)) continue;
                clearInvocations(walletRepository);

                locker.lock(WalletLocker.personal(a, "a"), WalletLocker.personal(b, "b"));

                UUID expectedFirst = a.compareTo(b) < 0 ? a : b;
                UUID expectedSecond = a.compareTo(b) < 0 ? b : a;
                InOrder inOrder = inOrder(walletRepository);
                inOrder.verify(walletRepository).findByUserIdForUpdate(expectedFirst);
                inOrder.verify(walletRepository).findByUserIdForUpdate(expectedSecond);
            }
        }
    }

    @Test
    void missingWalletFailsWithThatTargetsOwnMessage() {
        when(walletRepository.findByUserIdForUpdate(LOWER)).thenReturn(Optional.of(personalWallet(LOWER)));
        when(walletRepository.findByUserIdForUpdate(HIGHER)).thenReturn(Optional.empty());

        AppException ex = assertThrows(AppException.class, () ->
                locker.lock(WalletLocker.personal(LOWER, "Sender wallet not found"),
                        WalletLocker.personal(HIGHER, "Recipient wallet not found")));

        // Each target carries its own message so call sites keep the error they used to
        // raise when they locked the wallets themselves.
        assertEquals("Recipient wallet not found", ex.getMessage());
    }
}
