package com.aza.backend.service;

import com.aza.backend.entity.Agent;
import com.aza.backend.entity.FloatMovement;
import com.aza.backend.entity.User;
import com.aza.backend.entity.Wallet;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.AgentRepository;
import com.aza.backend.repository.FloatMovementRepository;
import com.aza.backend.repository.TransactionRepository;
import com.aza.backend.repository.WalletRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class FloatServiceTest {

    private final AgentRepository agentRepository = mock(AgentRepository.class);
    private final WalletRepository walletRepository = mock(WalletRepository.class);
    private final FloatMovementRepository floatMovementRepository = mock(FloatMovementRepository.class);
    private final FloatService service = new FloatService(
            agentRepository, walletRepository, floatMovementRepository,
            new WalletLedger(walletRepository, new WalletLocker(walletRepository), mock(TransactionRepository.class)));

    private final UUID agentId = UUID.randomUUID();
    private final UUID agentUserId = UUID.randomUUID();
    private final User admin = User.builder().id(UUID.randomUUID()).build();

    private Agent agent(BigDecimal floatLimit) {
        return Agent.builder().id(agentId).userId(agentUserId)
                .status(Agent.Status.ACTIVE).floatLimit(floatLimit).build();
    }

    private Wallet wallet(String balance) {
        return Wallet.builder().userId(agentUserId).balance(new BigDecimal(balance))
                .currency("GHS").frozen(false).build();
    }

    private void echoMovement() {
        when(floatMovementRepository.save(any(FloatMovement.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void mint_creditsFloatAndRecordsMovement() {
        Wallet wallet = wallet("100.00");
        when(agentRepository.findById(agentId)).thenReturn(Optional.of(agent(null)));
        when(walletRepository.findByUserIdAndTypeForUpdate(agentUserId, Wallet.WalletType.AGENT_FLOAT)).thenReturn(Optional.of(wallet));
        echoMovement();

        FloatMovement m = service.mint(admin, agentId, new BigDecimal("500.00"), "BANK-REF-1");

        assertEquals(new BigDecimal("600.00"), wallet.getBalance());
        assertEquals(FloatMovement.Type.MINT, m.getType());
        assertEquals(new BigDecimal("500.00"), m.getAmount());
        verify(walletRepository).save(wallet);
    }

    @Test
    void mint_rejectsWhenOverFloatLimit() {
        when(agentRepository.findById(agentId)).thenReturn(Optional.of(agent(new BigDecimal("1000.00"))));
        when(walletRepository.findByUserIdAndTypeForUpdate(agentUserId, Wallet.WalletType.AGENT_FLOAT)).thenReturn(Optional.of(wallet("800.00")));

        AppException ex = assertThrows(AppException.class,
                () -> service.mint(admin, agentId, new BigDecimal("500.00"), "BANK-REF-2")); // 1300 > 1000
        assertTrue(ex.getMessage().contains("float limit"));
        verify(floatMovementRepository, never()).save(any());
    }

    @Test
    void burn_debitsFloat() {
        Wallet wallet = wallet("600.00");
        when(agentRepository.findById(agentId)).thenReturn(Optional.of(agent(null)));
        when(walletRepository.findByUserIdAndTypeForUpdate(agentUserId, Wallet.WalletType.AGENT_FLOAT)).thenReturn(Optional.of(wallet));
        echoMovement();

        FloatMovement m = service.burn(admin, agentId, new BigDecimal("200.00"), "BANK-REF-3");

        assertEquals(new BigDecimal("400.00"), wallet.getBalance());
        assertEquals(FloatMovement.Type.BURN, m.getType());
    }

    @Test
    void burn_rejectsInsufficientFloat() {
        when(agentRepository.findById(agentId)).thenReturn(Optional.of(agent(null)));
        when(walletRepository.findByUserIdAndTypeForUpdate(agentUserId, Wallet.WalletType.AGENT_FLOAT)).thenReturn(Optional.of(wallet("100.00")));

        AppException ex = assertThrows(AppException.class,
                () -> service.burn(admin, agentId, new BigDecimal("200.00"), "BANK-REF-4"));
        assertTrue(ex.getMessage().toLowerCase().contains("too low"));
    }

    // ==================== one bank transaction, one movement ====================
    //
    // Mint is the only place e-money is created, so a deposit minted twice puts issued
    // e-money above the safeguarded balance. Maker-checker cannot catch it: two approvals
    // raised for one deposit are two legitimate approvals.

    @Test
    void mint_refusesABankReferenceAlreadyMinted() {
        when(floatMovementRepository.existsByTypeAndBankReference(FloatMovement.Type.MINT, "BANK-REF-DUP"))
                .thenReturn(true);

        AppException ex = assertThrows(AppException.class,
                () -> service.mint(admin, agentId, new BigDecimal("500.00"), "BANK-REF-DUP"));

        assertEquals("BANK_REFERENCE_ALREADY_USED", ex.getCode());
        verify(floatMovementRepository, never()).save(any());
        verify(walletRepository, never()).save(any(Wallet.class));
    }

    @Test
    void burn_refusesABankReferenceAlreadyBurned() {
        when(floatMovementRepository.existsByTypeAndBankReference(FloatMovement.Type.BURN, "BANK-REF-DUP"))
                .thenReturn(true);

        AppException ex = assertThrows(AppException.class,
                () -> service.burn(admin, agentId, new BigDecimal("200.00"), "BANK-REF-DUP"));

        assertEquals("BANK_REFERENCE_ALREADY_USED", ex.getCode());
        verify(walletRepository, never()).save(any(Wallet.class));
    }

    @Test
    void mintAndBurnMayShareAReference_aReturnedDepositIsOneBankTransactionBothWays() {
        // Only (type, reference) is unique, so a deposit that is later returned can cite
        // the same bank transaction for its burn.
        Wallet wallet = wallet("100.00");
        when(agentRepository.findById(agentId)).thenReturn(Optional.of(agent(null)));
        when(walletRepository.findByUserIdAndTypeForUpdate(agentUserId, Wallet.WalletType.AGENT_FLOAT))
                .thenReturn(Optional.of(wallet));
        when(floatMovementRepository.existsByTypeAndBankReference(FloatMovement.Type.MINT, "BANK-REF-5"))
                .thenReturn(true);
        when(floatMovementRepository.existsByTypeAndBankReference(FloatMovement.Type.BURN, "BANK-REF-5"))
                .thenReturn(false);
        echoMovement();

        FloatMovement m = service.burn(admin, agentId, new BigDecimal("50.00"), "BANK-REF-5");

        assertEquals(FloatMovement.Type.BURN, m.getType());
        assertEquals(new BigDecimal("50.00"), wallet.getBalance());
    }

    @Test
    void mint_requiresABankReference() {
        for (String missing : new String[]{null, "", "   "}) {
            AppException ex = assertThrows(AppException.class,
                    () -> service.mint(admin, agentId, new BigDecimal("500.00"), missing));
            assertEquals("BANK_REFERENCE_REQUIRED", ex.getCode());
        }
        verify(floatMovementRepository, never()).save(any());
    }

    @Test
    void referenceIsTrimmedSoPaddingCannotSlipADuplicatePast() {
        Wallet wallet = wallet("100.00");
        when(agentRepository.findById(agentId)).thenReturn(Optional.of(agent(null)));
        when(walletRepository.findByUserIdAndTypeForUpdate(agentUserId, Wallet.WalletType.AGENT_FLOAT))
                .thenReturn(Optional.of(wallet));
        echoMovement();

        service.mint(admin, agentId, new BigDecimal("10.00"), "  BANK-REF-6  ");

        verify(floatMovementRepository).existsByTypeAndBankReference(FloatMovement.Type.MINT, "BANK-REF-6");
    }
}
