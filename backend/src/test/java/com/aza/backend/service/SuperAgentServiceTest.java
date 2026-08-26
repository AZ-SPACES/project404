package com.aza.backend.service;

import com.aza.backend.dto.superagent.DistributeFloatRequest;
import com.aza.backend.dto.superagent.FloatDistributionResponse;
import com.aza.backend.entity.Agent;
import com.aza.backend.entity.FloatDistribution;
import com.aza.backend.entity.Transaction;
import com.aza.backend.entity.User;
import com.aza.backend.entity.Wallet;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.AgentRepository;
import com.aza.backend.repository.FloatDistributionRepository;
import com.aza.backend.repository.TransactionRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.repository.WalletRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SuperAgentServiceTest {

    private final AgentRepository agentRepository = mock(AgentRepository.class);
    private final WalletRepository walletRepository = mock(WalletRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final TransactionRepository transactionRepository = mock(TransactionRepository.class);
    private final FloatDistributionRepository floatDistributionRepository =
            mock(FloatDistributionRepository.class);
    private final UserService userService = mock(UserService.class);
    private final SuperAgentService service = new SuperAgentService(
            agentRepository, walletRepository, userRepository, transactionRepository,
            new WalletLedger(walletRepository, new WalletLocker(walletRepository), transactionRepository),
            floatDistributionRepository, new WalletLocker(walletRepository), userService);

    private final UUID masterUserId = UUID.randomUUID();
    private final UUID subUserId = UUID.randomUUID();
    private final UUID masterAgentId = UUID.randomUUID();
    private final UUID subAgentId = UUID.randomUUID();

    private User masterUser() { return User.builder().id(masterUserId).build(); }

    private Agent master() {
        return Agent.builder()
                .id(masterAgentId).userId(masterUserId)
                .status(Agent.Status.ACTIVE).tier(Agent.Tier.SUPER)
                .commissionAccruedGhs(BigDecimal.ZERO)
                .build();
    }

    private Agent sub() {
        return Agent.builder()
                .id(subAgentId).userId(subUserId).code("AZA-SUB123")
                .status(Agent.Status.ACTIVE).tier(Agent.Tier.STANDARD)
                .parentAgentId(masterAgentId)
                .commissionAccruedGhs(BigDecimal.ZERO)
                .build();
    }

    private Wallet floatWallet(UUID userId, String balance) {
        return Wallet.builder().userId(userId).type(Wallet.WalletType.AGENT_FLOAT)
                .balance(new BigDecimal(balance)).currency("GHS").frozen(false).build();
    }

    private DistributeFloatRequest request(String amount) {
        DistributeFloatRequest r = new DistributeFloatRequest();
        r.setSubAgentCode("AZA-SUB123");
        r.setAmount(new BigDecimal(amount));
        r.setPasscode("1234");
        // Unique per request, so a test never accidentally replays another test's movement.
        r.setIdempotencyKey(UUID.randomUUID().toString());
        return r;
    }

    /** Wires up the happy path: an active master, an active sub in its downline, both funded. */
    private Wallet[] wireUp(String masterBalance, String subBalance) {
        Agent master = master();
        Agent sub = sub();
        Wallet masterWallet = floatWallet(masterUserId, masterBalance);
        Wallet subWallet = floatWallet(subUserId, subBalance);

        when(agentRepository.findByUserId(masterUserId)).thenReturn(Optional.of(master));
        when(agentRepository.findByCode("AZA-SUB123")).thenReturn(Optional.of(sub));
        when(agentRepository.findById(subAgentId)).thenReturn(Optional.of(sub));
        when(walletRepository.findByUserIdAndTypeForUpdate(masterUserId, Wallet.WalletType.AGENT_FLOAT))
                .thenReturn(Optional.of(masterWallet));
        when(walletRepository.findByUserIdAndTypeForUpdate(subUserId, Wallet.WalletType.AGENT_FLOAT))
                .thenReturn(Optional.of(subWallet));
        when(walletRepository.findByUserIdAndType(masterUserId, Wallet.WalletType.AGENT_FLOAT))
                .thenReturn(Optional.of(masterWallet));
        when(walletRepository.findByUserIdAndType(subUserId, Wallet.WalletType.AGENT_FLOAT))
                .thenReturn(Optional.of(subWallet));
        when(transactionRepository.save(any(Transaction.class))).thenAnswer(inv -> {
            Transaction t = inv.getArgument(0);
            t.setId(UUID.randomUUID());
            return t;
        });
        when(floatDistributionRepository.save(any(FloatDistribution.class))).thenAnswer(inv -> {
            FloatDistribution d = inv.getArgument(0);
            d.setId(UUID.randomUUID());
            return d;
        });
        return new Wallet[]{masterWallet, subWallet};
    }

    @Test
    void distribute_movesFloatDownWithNoMargin() {
        Wallet[] wallets = wireUp("5000.00", "100.00");

        FloatDistributionResponse res = service.distribute(masterUser(), request("1200.00"));

        // The defining invariant: what leaves the master is exactly what lands in the sub.
        assertEquals(new BigDecimal("3800.00"), wallets[0].getBalance());
        assertEquals(new BigDecimal("1300.00"), wallets[1].getBalance());
        assertEquals(new BigDecimal("1200.00"), res.getAmount());
        assertEquals("DISTRIBUTE", res.getDirection());
        assertEquals("GHS", res.getCurrency());
    }

    @Test
    void distribute_takesNoFeeAndAccruesNoCommission() {
        wireUp("5000.00", "0.00");

        service.distribute(masterUser(), request("1000.00"));

        ArgumentCaptor<Transaction> captor = ArgumentCaptor.forClass(Transaction.class);
        verify(transactionRepository).save(captor.capture());
        Transaction tx = captor.getValue();
        assertEquals(0, tx.getFeeAmount().compareTo(BigDecimal.ZERO), "a distribution is never charged for");
        assertEquals(Transaction.TransactionType.FLOAT_DISTRIBUTION, tx.getType());
        assertEquals(new BigDecimal("1000.00"), tx.getAmount());

        // No margin means neither side's commission payable moves.
        verify(agentRepository, never()).save(any(Agent.class));
    }

    @Test
    void distribute_rejectsAnAgentOutsideTheDownline() {
        Agent master = master();
        Agent stranger = Agent.builder()
                .id(UUID.randomUUID()).userId(UUID.randomUUID()).code("AZA-SUB123")
                .status(Agent.Status.ACTIVE).tier(Agent.Tier.STANDARD)
                .parentAgentId(UUID.randomUUID())   // someone else's downline
                .build();
        when(agentRepository.findByUserId(masterUserId)).thenReturn(Optional.of(master));
        when(agentRepository.findByCode("AZA-SUB123")).thenReturn(Optional.of(stranger));

        AppException e = assertThrows(AppException.class,
                () -> service.distribute(masterUser(), request("100.00")));
        assertEquals("SUB_AGENT_NOT_FOUND", e.getCode());
        verify(walletRepository, never()).save(any(Wallet.class));
    }

    @Test
    void distribute_rejectsAnAmountAboveTheMastersFloat() {
        wireUp("50.00", "0.00");

        AppException e = assertThrows(AppException.class,
                () -> service.distribute(masterUser(), request("100.00")));
        assertEquals("INSUFFICIENT_FLOAT", e.getCode());
        verify(walletRepository, never()).save(any(Wallet.class));
    }

    @Test
    void distribute_respectsTheSubAgentsFloatLimit() {
        Agent master = master();
        Agent sub = sub();
        sub.setFloatLimit(new BigDecimal("500.00"));
        when(agentRepository.findByUserId(masterUserId)).thenReturn(Optional.of(master));
        when(agentRepository.findByCode("AZA-SUB123")).thenReturn(Optional.of(sub));
        when(walletRepository.findByUserIdAndTypeForUpdate(masterUserId, Wallet.WalletType.AGENT_FLOAT))
                .thenReturn(Optional.of(floatWallet(masterUserId, "5000.00")));
        when(walletRepository.findByUserIdAndTypeForUpdate(subUserId, Wallet.WalletType.AGENT_FLOAT))
                .thenReturn(Optional.of(floatWallet(subUserId, "400.00")));

        AppException e = assertThrows(AppException.class,
                () -> service.distribute(masterUser(), request("200.00")));
        assertEquals("FLOAT_LIMIT_EXCEEDED", e.getCode());
        verify(walletRepository, never()).save(any(Wallet.class));
    }

    @Test
    void recall_movesFloatBackUp() {
        Wallet[] wallets = wireUp("1000.00", "800.00");

        FloatDistributionResponse res = service.recall(masterUser(), request("300.00"));

        assertEquals(new BigDecimal("1300.00"), wallets[0].getBalance());
        assertEquals(new BigDecimal("500.00"), wallets[1].getBalance());
        assertEquals("RECALL", res.getDirection());
    }

    @Test
    void recall_rejectsMoreThanTheSubAgentHolds() {
        wireUp("1000.00", "50.00");

        AppException e = assertThrows(AppException.class,
                () -> service.recall(masterUser(), request("300.00")));
        assertEquals("INSUFFICIENT_FLOAT", e.getCode());
    }

    @Test
    void distribute_replayingAnIdempotencyKeyReturnsTheOriginalAndMovesNothing() {
        Agent master = master();
        when(agentRepository.findByUserId(masterUserId)).thenReturn(Optional.of(master));
        when(agentRepository.findById(subAgentId)).thenReturn(Optional.of(sub()));
        when(walletRepository.findByUserIdAndType(any(), eq(Wallet.WalletType.AGENT_FLOAT)))
                .thenReturn(Optional.of(floatWallet(masterUserId, "3800.00")));

        FloatDistribution prior = FloatDistribution.builder()
                .id(UUID.randomUUID()).superAgentId(masterAgentId).subAgentId(subAgentId)
                .direction(FloatDistribution.Direction.DISTRIBUTE)
                .amount(new BigDecimal("1200.00")).currency("GHS")
                .idempotencyKey("key-1").build();
        when(floatDistributionRepository.findByIdempotencyKey("key-1")).thenReturn(Optional.of(prior));

        DistributeFloatRequest req = request("1200.00");
        req.setIdempotencyKey("key-1");
        FloatDistributionResponse res = service.distribute(masterUser(), req);

        assertEquals(prior.getId().toString(), res.getId());
        verify(walletRepository, never()).save(any(Wallet.class));
        verify(floatDistributionRepository, never()).save(any(FloatDistribution.class));
    }

    @Test
    void distribute_rejectsAnIdempotencyKeyBelongingToAnotherMaster() {
        when(agentRepository.findByUserId(masterUserId)).thenReturn(Optional.of(master()));
        FloatDistribution someoneElses = FloatDistribution.builder()
                .id(UUID.randomUUID()).superAgentId(UUID.randomUUID()).subAgentId(UUID.randomUUID())
                .direction(FloatDistribution.Direction.DISTRIBUTE)
                .amount(new BigDecimal("10.00")).idempotencyKey("key-1").build();
        when(floatDistributionRepository.findByIdempotencyKey("key-1")).thenReturn(Optional.of(someoneElses));

        DistributeFloatRequest req = request("1200.00");
        req.setIdempotencyKey("key-1");

        AppException e = assertThrows(AppException.class, () -> service.distribute(masterUser(), req));
        assertEquals("INVALID_IDEMPOTENCY_KEY", e.getCode());
    }

    @Test
    void distribute_rejectsAStandardTierAgent() {
        Agent standard = master();
        standard.setTier(Agent.Tier.STANDARD);
        when(agentRepository.findByUserId(masterUserId)).thenReturn(Optional.of(standard));

        AppException e = assertThrows(AppException.class,
                () -> service.distribute(masterUser(), request("100.00")));
        assertEquals("NOT_A_SUPER_AGENT", e.getCode());
    }

    @Test
    void distribute_rejectsFractionalPesewas() {
        wireUp("5000.00", "0.00");
        DistributeFloatRequest req = request("100.001");

        AppException e = assertThrows(AppException.class, () -> service.distribute(masterUser(), req));
        assertEquals("INVALID_AMOUNT", e.getCode());
    }

    @Test
    void distribute_rejectsASuspendedSubAgent() {
        Agent master = master();
        Agent suspended = sub();
        suspended.setStatus(Agent.Status.SUSPENDED);
        when(agentRepository.findByUserId(masterUserId)).thenReturn(Optional.of(master));
        when(agentRepository.findByCode("AZA-SUB123")).thenReturn(Optional.of(suspended));

        AppException e = assertThrows(AppException.class,
                () -> service.distribute(masterUser(), request("100.00")));
        assertEquals("SUB_AGENT_NOT_ACTIVE", e.getCode());
    }

    @Test
    void distribute_refusesAWrongPasscodeBeforeMovingAnything() {
        wireUp("5000.00", "0.00");
        doThrow(new AppException("Invalid passcode."))
                .when(userService).verifyPasscode(any(User.class), eq("9999"));

        DistributeFloatRequest req = request("1000.00");
        req.setPasscode("9999");

        assertThrows(AppException.class, () -> service.distribute(masterUser(), req));
        verify(walletRepository, never()).save(any(Wallet.class));
        verify(floatDistributionRepository, never()).save(any(FloatDistribution.class));
    }

    @Test
    void distribute_refusesARequestWithNoIdempotencyKey() {
        when(agentRepository.findByUserId(masterUserId)).thenReturn(Optional.of(master()));
        DistributeFloatRequest req = request("1000.00");
        req.setIdempotencyKey(null);

        AppException e = assertThrows(AppException.class, () -> service.distribute(masterUser(), req));
        assertEquals("IDEMPOTENCY_KEY_REQUIRED", e.getCode());
        verify(walletRepository, never()).save(any(Wallet.class));
    }

    @Test
    void distribute_replayDoesNotSpendAPasscodeAttempt() {
        Agent master = master();
        when(agentRepository.findByUserId(masterUserId)).thenReturn(Optional.of(master));
        when(agentRepository.findById(subAgentId)).thenReturn(Optional.of(sub()));
        when(walletRepository.findByUserIdAndType(any(), eq(Wallet.WalletType.AGENT_FLOAT)))
                .thenReturn(Optional.of(floatWallet(masterUserId, "3800.00")));
        FloatDistribution prior = FloatDistribution.builder()
                .id(UUID.randomUUID()).superAgentId(masterAgentId).subAgentId(subAgentId)
                .direction(FloatDistribution.Direction.DISTRIBUTE)
                .amount(new BigDecimal("1200.00")).currency("GHS").idempotencyKey("key-2").build();
        when(floatDistributionRepository.findByIdempotencyKey("key-2")).thenReturn(Optional.of(prior));

        DistributeFloatRequest req = request("1200.00");
        req.setIdempotencyKey("key-2");
        service.distribute(masterUser(), req);

        // The retry is answered from the ledger, so it never counts against the five attempts.
        verify(userService, never()).verifyPasscode(any(User.class), anyString());
    }

    @Test
    void me_reportsNotSuperForAStandardAgent() {
        Agent standard = master();
        standard.setTier(Agent.Tier.STANDARD);
        when(agentRepository.findByUserId(masterUserId)).thenReturn(Optional.of(standard));

        assertEquals("NOT_SUPER", service.me(masterUser()).getStatus());
    }

    @Test
    void me_reportsNoneWhenTheUserIsNotAnAgent() {
        when(agentRepository.findByUserId(masterUserId)).thenReturn(Optional.empty());

        assertEquals("NONE", service.me(masterUser()).getStatus());
    }

}
