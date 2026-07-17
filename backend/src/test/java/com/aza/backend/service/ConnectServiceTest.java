package com.aza.backend.service;

import com.aza.backend.dto.connect.ConnectTransferRequest;
import com.aza.backend.dto.connect.ConnectTransferResponse;
import com.aza.backend.entity.ConnectTransfer;
import com.aza.backend.entity.Merchant;
import com.aza.backend.entity.Transaction;
import com.aza.backend.entity.User;
import com.aza.backend.entity.Wallet;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.ConnectTransferRepository;
import com.aza.backend.repository.MerchantRepository;
import com.aza.backend.repository.TransactionRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.repository.WalletRepository;
import com.aza.backend.util.RateLimitService;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ConnectServiceTest {

    private final MerchantRepository merchantRepository = mock(MerchantRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final WalletRepository walletRepository = mock(WalletRepository.class);
    private final TransactionRepository transactionRepository = mock(TransactionRepository.class);
    private final ConnectTransferRepository connectTransferRepository = mock(ConnectTransferRepository.class);
    private final NotificationService notificationService = mock(NotificationService.class);
    private final RateLimitService rateLimitService = mock(RateLimitService.class);

    private final ConnectService service = new ConnectService(
            merchantRepository, userRepository, walletRepository, transactionRepository,
            connectTransferRepository, notificationService, rateLimitService);

    private final UUID merchantId = UUID.randomUUID();
    private final UUID ownerUserId = UUID.randomUUID();
    private final UUID sellerId = UUID.randomUUID();

    private Merchant merchant(String balance) {
        return Merchant.builder()
                .id(merchantId).userId(ownerUserId).businessName("TradePay")
                .status(Merchant.MerchantStatus.ACTIVE)
                .balance(new BigDecimal(balance)).currency("GHS")
                .totalVolume(BigDecimal.ZERO).feeRateBps(150)
                .build();
    }

    private User seller() {
        return User.builder().id(sellerId).firstName("Ama").lastName("Owusu")
                .status(User.AccountStatus.ACTIVE).build();
    }

    private Wallet sellerWallet(String balance) {
        return Wallet.builder().userId(sellerId).balance(new BigDecimal(balance))
                .currency("GHS").frozen(false).build();
    }

    private ConnectTransferRequest req(String amount) {
        ConnectTransferRequest r = new ConnectTransferRequest();
        r.setRecipient("ama@example.com");
        r.setAmount(new BigDecimal(amount));
        return r;
    }

    private void stubSave() {
        when(connectTransferRepository.save(any(ConnectTransfer.class))).thenAnswer(inv -> {
            ConnectTransfer t = inv.getArgument(0);
            if (t.getId() == null) t.setId(UUID.randomUUID());
            return t;
        });
        when(transactionRepository.save(any(Transaction.class))).thenAnswer(inv -> {
            Transaction t = inv.getArgument(0);
            if (t.getId() == null) t.setId(UUID.randomUUID());
            return t;
        });
    }

    @Test
    void transfer_movesFundsFromMerchantToSeller() {
        Merchant m = merchant("100.00");
        Wallet w = sellerWallet("10.00");
        when(merchantRepository.findByIdForUpdate(merchantId)).thenReturn(Optional.of(m));
        when(userRepository.findByEmailIgnoreCaseOrUsername(anyString(), anyString())).thenReturn(Optional.of(seller()));
        when(walletRepository.findByUserIdForUpdate(sellerId)).thenReturn(Optional.of(w));
        stubSave();

        ConnectTransferResponse res = service.transfer(merchantId, false, req("30.00"));

        assertEquals("COMPLETED", res.getStatus());
        assertEquals(0, new BigDecimal("70.00").compareTo(m.getBalance()));
        assertEquals(0, new BigDecimal("40.00").compareTo(w.getBalance()));
        verify(transactionRepository).save(any(Transaction.class));
        verify(notificationService).sendNotification(eq(sellerId), any(), anyString(), anyString(), any());
    }

    @Test
    void transfer_rejectsInsufficientFunds() {
        Merchant m = merchant("20.00");
        when(merchantRepository.findByIdForUpdate(merchantId)).thenReturn(Optional.of(m));
        when(userRepository.findByEmailIgnoreCaseOrUsername(anyString(), anyString())).thenReturn(Optional.of(seller()));
        when(walletRepository.findByUserIdForUpdate(sellerId)).thenReturn(Optional.of(sellerWallet("0.00")));

        AppException ex = assertThrows(AppException.class, () -> service.transfer(merchantId, false, req("30.00")));
        assertEquals("INSUFFICIENT_FUNDS", ex.getCode());
        assertEquals(0, new BigDecimal("20.00").compareTo(m.getBalance()));
        verify(transactionRepository, never()).save(any());
    }

    @Test
    void transfer_isIdempotent() {
        ConnectTransfer prior = ConnectTransfer.builder()
                .id(UUID.randomUUID()).merchantId(merchantId).recipientIdentifier("ama@example.com")
                .amount(new BigDecimal("30.00")).currency("GHS")
                .status(ConnectTransfer.Status.COMPLETED).testMode(false).idempotencyKey("k1")
                .build();
        when(connectTransferRepository.findByMerchantIdAndIdempotencyKey(merchantId, "k1"))
                .thenReturn(Optional.of(prior));

        ConnectTransferRequest r = req("30.00");
        r.setIdempotencyKey("k1");
        ConnectTransferResponse res = service.transfer(merchantId, false, r);

        assertEquals(prior.getId(), res.getId());
        verify(merchantRepository, never()).findByIdForUpdate(any());
        verify(transactionRepository, never()).save(any());
    }

    @Test
    void transfer_testModeMovesNoMoney() {
        Merchant m = merchant("100.00");
        Wallet w = sellerWallet("10.00");
        when(merchantRepository.findByIdForUpdate(merchantId)).thenReturn(Optional.of(m));
        when(userRepository.findByEmailIgnoreCaseOrUsername(anyString(), anyString())).thenReturn(Optional.of(seller()));
        stubSave();

        ConnectTransferResponse res = service.transfer(merchantId, true, req("30.00"));

        assertEquals("SIMULATED", res.getStatus());
        assertEquals(0, new BigDecimal("100.00").compareTo(m.getBalance()));
        assertEquals(0, new BigDecimal("10.00").compareTo(w.getBalance()));
        verify(transactionRepository, never()).save(any());
        verify(walletRepository, never()).findByUserIdForUpdate(any());
    }

    @Test
    void transfer_rejectsSelfTransfer() {
        Merchant m = merchant("100.00");
        User self = User.builder().id(ownerUserId).status(User.AccountStatus.ACTIVE).build();
        when(merchantRepository.findByIdForUpdate(merchantId)).thenReturn(Optional.of(m));
        when(userRepository.findByEmailIgnoreCaseOrUsername(anyString(), anyString())).thenReturn(Optional.of(self));

        AppException ex = assertThrows(AppException.class, () -> service.transfer(merchantId, false, req("30.00")));
        assertEquals("SELF_TRANSFER", ex.getCode());
    }
}
