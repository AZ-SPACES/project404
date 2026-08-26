package com.aza.backend.service;

import com.aza.backend.entity.Merchant;
import com.aza.backend.entity.Transaction;
import com.aza.backend.entity.User;
import com.aza.backend.entity.Wallet;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Reversing a payment is the one admin action that moves money backwards, so the two ways
 * it can be wrong both matter: sending the refund to the wrong place, and sending it twice.
 *
 * <p>The merchant cases exist because {@code transactions.recipient_id} points at either a
 * users row or a merchants row. Reading it without checking {@code recipientType} looked
 * for a wallet under a merchant's id, found none, and failed every attempt to reverse a
 * store sale.
 */
class TransactionReversalTest {

    private final UserRepository userRepository = mock(UserRepository.class);
    private final WalletRepository walletRepository = mock(WalletRepository.class);
    private final TransactionRepository transactionRepository = mock(TransactionRepository.class);
    private final KycRecordRepository kycRecordRepository = mock(KycRecordRepository.class);
    private final MerchantRepository merchantRepository = mock(MerchantRepository.class);
    private final PresenceService presenceService = mock(PresenceService.class);
    private final AdminAuditService auditService = mock(AdminAuditService.class);
    private final NotificationService notificationService = mock(NotificationService.class);

    private final WalletLocker walletLocker = new WalletLocker(walletRepository);
    private final WalletLedger walletLedger =
            new WalletLedger(walletRepository, walletLocker, transactionRepository);

    private final AdminService service = new AdminService(
            userRepository, walletRepository, walletLedger, walletLocker, transactionRepository,
            kycRecordRepository, merchantRepository, presenceService, auditService, notificationService);

    private final UUID senderId = UUID.randomUUID();
    private final UUID recipientId = UUID.randomUUID();
    private final UUID merchantId = UUID.randomUUID();
    private final User admin = User.builder().id(UUID.randomUUID()).email("ops@aza.systems").build();

    @BeforeEach
    void stubSaves() {
        when(walletRepository.save(any(Wallet.class))).thenAnswer(i -> i.getArgument(0));
        when(transactionRepository.save(any(Transaction.class))).thenAnswer(i -> i.getArgument(0));
        when(merchantRepository.save(any(Merchant.class))).thenAnswer(i -> i.getArgument(0));
    }

    private static Wallet wallet(UUID userId, String balance) {
        return Wallet.builder().id(UUID.randomUUID()).userId(userId)
                .type(Wallet.WalletType.PERSONAL).balance(new BigDecimal(balance))
                .currency("GHS").frozen(false).build();
    }

    private Transaction completed(Transaction.RecipientType type, UUID to, String amount, String fee) {
        return Transaction.builder()
                .id(UUID.randomUUID())
                .senderId(senderId).recipientId(to).recipientType(type)
                .amount(new BigDecimal(amount))
                .feeAmount(fee == null ? null : new BigDecimal(fee))
                .status(Transaction.TransactionStatus.COMPLETED)
                .type(type == Transaction.RecipientType.MERCHANT
                        ? Transaction.TransactionType.MERCHANT_PAYMENT
                        : Transaction.TransactionType.TRANSFER)
                .build();
    }

    private Merchant merchant(String balance) {
        return Merchant.builder().id(merchantId).userId(UUID.randomUUID())
                .businessName("JollofCo").businessHandle("jollofco")
                .status(Merchant.MerchantStatus.ACTIVE)
                .balance(new BigDecimal(balance)).currency("GHS")
                .totalVolume(BigDecimal.ZERO).build();
    }

    // ==================== user-to-user ====================

    @Test
    void reversesUserTransfer_debitsRecipientCreditsSender() {
        Transaction tx = completed(Transaction.RecipientType.USER, recipientId, "50.00", null);
        Wallet senderWallet = wallet(senderId, "10.00");
        Wallet recipientWallet = wallet(recipientId, "50.00");
        when(transactionRepository.findByIdForUpdate(tx.getId())).thenReturn(Optional.of(tx));
        when(walletRepository.findByUserIdForUpdate(senderId)).thenReturn(Optional.of(senderWallet));
        when(walletRepository.findByUserIdForUpdate(recipientId)).thenReturn(Optional.of(recipientWallet));

        service.reverseTransaction(tx.getId(), admin);

        assertEquals(0, new BigDecimal("60.00").compareTo(senderWallet.getBalance()), "sender made whole");
        assertEquals(0, BigDecimal.ZERO.compareTo(recipientWallet.getBalance()), "recipient debited");
        assertEquals(Transaction.TransactionStatus.REVERSED, tx.getStatus());
    }

    @Test
    void refusesWhenRecipientHasSpentTheMoney() {
        Transaction tx = completed(Transaction.RecipientType.USER, recipientId, "50.00", null);
        Wallet senderWallet = wallet(senderId, "0.00");
        Wallet recipientWallet = wallet(recipientId, "49.99");
        when(transactionRepository.findByIdForUpdate(tx.getId())).thenReturn(Optional.of(tx));
        when(walletRepository.findByUserIdForUpdate(senderId)).thenReturn(Optional.of(senderWallet));
        when(walletRepository.findByUserIdForUpdate(recipientId)).thenReturn(Optional.of(recipientWallet));

        AppException e = assertThrows(AppException.class, () -> service.reverseTransaction(tx.getId(), admin));

        assertEquals("INSUFFICIENT_FUNDS", e.getCode());
        assertEquals(0, BigDecimal.ZERO.compareTo(senderWallet.getBalance()), "no money invented");
        assertEquals(Transaction.TransactionStatus.COMPLETED, tx.getStatus(), "stays reversible");
    }

    // ==================== store sale ====================

    @Test
    void reversesMerchantPayment_clawsBackNetRefundsGross() {
        // Customer paid 100.00; AZA took 1.50 MDR, so the merchant banked 98.50.
        Transaction tx = completed(Transaction.RecipientType.MERCHANT, merchantId, "100.00", "1.50");
        Wallet senderWallet = wallet(senderId, "0.00");
        Merchant m = merchant("500.00");
        when(transactionRepository.findByIdForUpdate(tx.getId())).thenReturn(Optional.of(tx));
        when(merchantRepository.findByIdForUpdate(merchantId)).thenReturn(Optional.of(m));
        when(merchantRepository.findById(merchantId)).thenReturn(Optional.of(m));
        when(walletRepository.findByUserIdForUpdate(senderId)).thenReturn(Optional.of(senderWallet));

        service.reverseTransaction(tx.getId(), admin);

        assertEquals(0, new BigDecimal("401.50").compareTo(m.getBalance()),
                "merchant gives back only what it banked (500.00 - 98.50)");
        assertEquals(0, new BigDecimal("100.00").compareTo(senderWallet.getBalance()),
                "customer refunded the gross they paid; AZA gives back its own fee");
        assertEquals(Transaction.TransactionStatus.REVERSED, tx.getStatus());
    }

    @Test
    void reversesMerchantPayment_neverLooksForAWalletUnderTheMerchantId() {
        Transaction tx = completed(Transaction.RecipientType.MERCHANT, merchantId, "20.00", "0.30");
        when(transactionRepository.findByIdForUpdate(tx.getId())).thenReturn(Optional.of(tx));
        when(merchantRepository.findByIdForUpdate(merchantId)).thenReturn(Optional.of(merchant("100.00")));
        when(merchantRepository.findById(merchantId)).thenReturn(Optional.of(merchant("100.00")));
        when(walletRepository.findByUserIdForUpdate(senderId)).thenReturn(Optional.of(wallet(senderId, "0.00")));

        service.reverseTransaction(tx.getId(), admin);

        // The bug this replaces: the merchant id was passed to a wallet finder, which
        // returned empty and failed the reversal outright.
        verify(walletRepository, never()).findByUserIdForUpdate(merchantId);
    }

    @Test
    void legacyMerchantPaymentWithNoRecordedFee_clawsBackTheGross() {
        // Rows written before the MDR was recorded on the transaction.
        Transaction tx = completed(Transaction.RecipientType.MERCHANT, merchantId, "40.00", null);
        Wallet senderWallet = wallet(senderId, "0.00");
        Merchant m = merchant("100.00");
        when(transactionRepository.findByIdForUpdate(tx.getId())).thenReturn(Optional.of(tx));
        when(merchantRepository.findByIdForUpdate(merchantId)).thenReturn(Optional.of(m));
        when(merchantRepository.findById(merchantId)).thenReturn(Optional.of(m));
        when(walletRepository.findByUserIdForUpdate(senderId)).thenReturn(Optional.of(senderWallet));

        service.reverseTransaction(tx.getId(), admin);

        assertEquals(0, new BigDecimal("60.00").compareTo(m.getBalance()), "gross clawed back");
        assertEquals(0, new BigDecimal("40.00").compareTo(senderWallet.getBalance()), "customer still whole");
    }

    @Test
    void refusesWhenMerchantHasAlreadyPaidOutTheSale() {
        Transaction tx = completed(Transaction.RecipientType.MERCHANT, merchantId, "100.00", "1.50");
        Merchant m = merchant("10.00");
        when(transactionRepository.findByIdForUpdate(tx.getId())).thenReturn(Optional.of(tx));
        when(merchantRepository.findByIdForUpdate(merchantId)).thenReturn(Optional.of(m));

        AppException e = assertThrows(AppException.class, () -> service.reverseTransaction(tx.getId(), admin));

        assertEquals("INSUFFICIENT_FUNDS", e.getCode());
        assertEquals(0, new BigDecimal("10.00").compareTo(m.getBalance()), "merchant untouched");
        assertEquals(Transaction.TransactionStatus.COMPLETED, tx.getStatus());
    }

    // ==================== double reversal ====================

    @Test
    void takesTheRowLockBeforeCheckingStatus() {
        Transaction tx = completed(Transaction.RecipientType.USER, recipientId, "5.00", null);
        when(transactionRepository.findByIdForUpdate(tx.getId())).thenReturn(Optional.of(tx));
        when(walletRepository.findByUserIdForUpdate(senderId)).thenReturn(Optional.of(wallet(senderId, "0.00")));
        when(walletRepository.findByUserIdForUpdate(recipientId)).thenReturn(Optional.of(wallet(recipientId, "5.00")));

        service.reverseTransaction(tx.getId(), admin);

        // The COMPLETED check is a read-modify-write on this row; an unlocked read lets
        // two approvals both see COMPLETED and both refund.
        verify(transactionRepository).findByIdForUpdate(tx.getId());
        verify(transactionRepository, never()).findById(tx.getId());
    }

    @Test
    void refusesToReverseAnAlreadyReversedTransaction() {
        Transaction tx = completed(Transaction.RecipientType.USER, recipientId, "5.00", null);
        tx.setStatus(Transaction.TransactionStatus.REVERSED);
        when(transactionRepository.findByIdForUpdate(tx.getId())).thenReturn(Optional.of(tx));

        AppException e = assertThrows(AppException.class, () -> service.reverseTransaction(tx.getId(), admin));

        assertEquals("INVALID_STATE", e.getCode());
        verify(walletRepository, never()).save(any(Wallet.class));
    }
}
