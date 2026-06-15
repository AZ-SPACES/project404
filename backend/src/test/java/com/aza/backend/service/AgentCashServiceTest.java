package com.aza.backend.service;

import com.aza.backend.dto.agent.AgentCashResponse;
import com.aza.backend.entity.Agent;
import com.aza.backend.entity.Transaction;
import com.aza.backend.entity.User;
import com.aza.backend.entity.Wallet;
import com.aza.backend.entity.WithdrawalCode;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.AgentRepository;
import com.aza.backend.repository.TransactionRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.repository.WalletRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AgentCashServiceTest {

    private final AgentRepository agentRepository = mock(AgentRepository.class);
    private final WalletRepository walletRepository = mock(WalletRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final TransactionRepository transactionRepository = mock(TransactionRepository.class);
    private final FeeCalculationService feeCalculationService = mock(FeeCalculationService.class);
    private final WithdrawalCodeService withdrawalCodeService = mock(WithdrawalCodeService.class);
    private final RiskEngineService riskEngineService = mock(RiskEngineService.class);
    private final AgentCashService service = new AgentCashService(
            agentRepository, walletRepository, userRepository, transactionRepository,
            feeCalculationService, withdrawalCodeService, new LimitGuard(), riskEngineService);

    private final UUID agentUserId = UUID.randomUUID();
    private final UUID customerId = UUID.randomUUID();

    private User agentUser() { return User.builder().id(agentUserId).build(); }
    private User customer()  { return User.builder().id(customerId).firstName("Bob").build(); }

    private Agent activeAgent() {
        return Agent.builder()
                .id(UUID.randomUUID()).userId(agentUserId)
                .status(Agent.Status.ACTIVE).tier(Agent.Tier.STANDARD)
                .cashInCommissionBps(20).cashOutCommissionShareBps(5000)
                .commissionAccruedGhs(BigDecimal.ZERO)
                .build();
    }

    private Wallet wallet(UUID userId, String balance) {
        return Wallet.builder().userId(userId).balance(new BigDecimal(balance))
                .currency("GHS").frozen(false).build();
    }

    @Test
    void cashIn_movesFloatToCustomer_andAccruesCommission() {
        Agent agent = activeAgent();
        Wallet agentWallet = wallet(agentUserId, "1000.00");
        Wallet customerWallet = wallet(customerId, "0.00");

        when(agentRepository.findByUserId(agentUserId)).thenReturn(Optional.of(agent));
        when(userRepository.findByEmailOrPhoneNumber("cust@x", "cust@x")).thenReturn(Optional.of(customer()));
        when(walletRepository.findByUserIdForUpdate(agentUserId)).thenReturn(Optional.of(agentWallet));
        when(walletRepository.findByUserIdForUpdate(customerId)).thenReturn(Optional.of(customerWallet));
        when(walletRepository.findByUserId(agentUserId)).thenReturn(Optional.of(agentWallet));
        when(transactionRepository.save(any(Transaction.class))).thenAnswer(inv -> {
            Transaction t = inv.getArgument(0);
            if (t.getId() == null) t.setId(UUID.randomUUID());
            return t;
        });

        AgentCashResponse res = service.cashIn(agentUser(), "cust@x", new BigDecimal("200.00"), null);

        assertEquals(new BigDecimal("800.00"), agentWallet.getBalance());   // float reduced
        assertEquals(new BigDecimal("200.00"), customerWallet.getBalance()); // customer credited
        assertEquals(new BigDecimal("0.40"), agent.getCommissionAccruedGhs()); // 0.2% of 200
        assertEquals("CASH_IN", res.getType());
        assertEquals(0, res.getFee().compareTo(BigDecimal.ZERO));
        verify(transactionRepository).save(argThat(t ->
                t.getType() == Transaction.TransactionType.CASH_IN
                        && t.getStatus() == Transaction.TransactionStatus.COMPLETED));
    }

    @Test
    void cashIn_commissionRespectsMinimum() {
        Agent agent = activeAgent();
        Wallet agentWallet = wallet(agentUserId, "1000.00");
        when(agentRepository.findByUserId(agentUserId)).thenReturn(Optional.of(agent));
        when(userRepository.findByEmailOrPhoneNumber(any(), any())).thenReturn(Optional.of(customer()));
        when(walletRepository.findByUserIdForUpdate(agentUserId)).thenReturn(Optional.of(agentWallet));
        when(walletRepository.findByUserIdForUpdate(customerId)).thenReturn(Optional.of(wallet(customerId, "0.00")));
        when(walletRepository.findByUserId(agentUserId)).thenReturn(Optional.of(agentWallet));
        when(transactionRepository.save(any(Transaction.class))).thenAnswer(inv -> {
            Transaction t = inv.getArgument(0);
            if (t.getId() == null) t.setId(UUID.randomUUID());
            return t;
        });

        service.cashIn(agentUser(), "cust@x", new BigDecimal("10.00"), null); // 0.2% = 0.02 -> min 0.10
        assertEquals(new BigDecimal("0.10"), agent.getCommissionAccruedGhs());
    }

    @Test
    void cashIn_rejectsInactiveAgent() {
        Agent pending = activeAgent();
        pending.setStatus(Agent.Status.PENDING);
        when(agentRepository.findByUserId(agentUserId)).thenReturn(Optional.of(pending));

        AppException ex = assertThrows(AppException.class,
                () -> service.cashIn(agentUser(), "cust@x", new BigDecimal("200.00"), null));
        assertTrue(ex.getMessage().contains("not active"));
    }

    @Test
    void cashIn_rejectsInsufficientFloat() {
        Agent agent = activeAgent();
        when(agentRepository.findByUserId(agentUserId)).thenReturn(Optional.of(agent));
        when(userRepository.findByEmailOrPhoneNumber(any(), any())).thenReturn(Optional.of(customer()));
        when(walletRepository.findByUserIdForUpdate(agentUserId)).thenReturn(Optional.of(wallet(agentUserId, "100.00")));

        AppException ex = assertThrows(AppException.class,
                () -> service.cashIn(agentUser(), "cust@x", new BigDecimal("200.00"), null));
        assertTrue(ex.getMessage().contains("float"));
    }

    private WithdrawalCode code(String amount) {
        return WithdrawalCode.builder()
                .id(UUID.randomUUID()).userId(customerId).amount(new BigDecimal(amount))
                .status(WithdrawalCode.Status.ACTIVE).build();
    }

    @Test
    void cashOut_debitsCustomerAndCreditsAgentFloatPlusCommissionShare() {
        Agent agent = activeAgent();
        Wallet customerWallet = wallet(customerId, "500.00");
        Wallet agentWallet = wallet(agentUserId, "1000.00");

        when(agentRepository.findByUserId(agentUserId)).thenReturn(Optional.of(agent));
        when(withdrawalCodeService.consume("ABCDEFGHJK", agentUserId)).thenReturn(code("100.00"));
        when(userRepository.findById(customerId)).thenReturn(Optional.of(customer()));
        when(feeCalculationService.quote(eq("CASH_OUT"), eq(new BigDecimal("100.00")), eq(customerId)))
                .thenReturn(new FeeCalculationService.FeeQuote(new BigDecimal("1.00"), UUID.randomUUID(), false));
        when(walletRepository.findByUserIdForUpdate(customerId)).thenReturn(Optional.of(customerWallet));
        when(walletRepository.findByUserIdForUpdate(agentUserId)).thenReturn(Optional.of(agentWallet));
        when(walletRepository.findByUserId(agentUserId)).thenReturn(Optional.of(agentWallet));
        when(transactionRepository.save(any(Transaction.class))).thenAnswer(inv -> {
            Transaction t = inv.getArgument(0);
            if (t.getId() == null) t.setId(UUID.randomUUID());
            return t;
        });

        AgentCashResponse res = service.cashOut(agentUser(), "ABCDEFGHJK", null);

        assertEquals(new BigDecimal("399.00"), customerWallet.getBalance());   // 500 - 100 - 1 fee
        assertEquals(new BigDecimal("1100.50"), agentWallet.getBalance());     // 1000 + 100 + 0.50 share
        assertEquals("CASH_OUT", res.getType());
        assertEquals(new BigDecimal("1.00"), res.getFee());
        verify(transactionRepository).save(argThat(t ->
                t.getType() == Transaction.TransactionType.CASH_OUT
                        && t.getSenderId().equals(customerId)
                        && t.getRecipientId().equals(agentUserId)));
    }

    @Test
    void cashOut_rejectsWhenCustomerCannotCoverAmountPlusFee() {
        Agent agent = activeAgent();
        when(agentRepository.findByUserId(agentUserId)).thenReturn(Optional.of(agent));
        when(withdrawalCodeService.consume("ABCDEFGHJK", agentUserId)).thenReturn(code("100.00"));
        when(userRepository.findById(customerId)).thenReturn(Optional.of(customer()));
        when(feeCalculationService.quote(eq("CASH_OUT"), eq(new BigDecimal("100.00")), eq(customerId)))
                .thenReturn(new FeeCalculationService.FeeQuote(new BigDecimal("1.00"), UUID.randomUUID(), false));
        when(walletRepository.findByUserIdForUpdate(customerId)).thenReturn(Optional.of(wallet(customerId, "50.00")));

        AppException ex = assertThrows(AppException.class,
                () -> service.cashOut(agentUser(), "ABCDEFGHJK", null));
        assertTrue(ex.getMessage().toLowerCase().contains("too low"));
    }
}
