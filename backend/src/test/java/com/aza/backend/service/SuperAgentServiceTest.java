package com.aza.backend.service;

import com.aza.backend.dto.agent.FloatDistributionResponse;
import com.aza.backend.entity.Agent;
import com.aza.backend.entity.Transaction;
import com.aza.backend.entity.User;
import com.aza.backend.entity.Wallet;
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

class SuperAgentServiceTest {

    private final AgentRepository agentRepository = mock(AgentRepository.class);
    private final WalletRepository walletRepository = mock(WalletRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final TransactionRepository transactionRepository = mock(TransactionRepository.class);
    private final SuperAgentService service = new SuperAgentService(
            agentRepository, walletRepository, userRepository, transactionRepository);

    private final UUID superUserId = UUID.randomUUID();
    private final UUID targetUserId = UUID.randomUUID();
    private static final String TARGET_CODE = "AZA-TGT123";

    private User superUser() { return User.builder().id(superUserId).build(); }

    private Agent superAgent() {
        return Agent.builder()
                .id(UUID.randomUUID()).userId(superUserId)
                .status(Agent.Status.ACTIVE).tier(Agent.Tier.SUPER)
                .commissionAccruedGhs(BigDecimal.ZERO)
                .build();
    }

    private Agent targetAgent(String floatLimit) {
        return Agent.builder()
                .id(UUID.randomUUID()).userId(targetUserId).code(TARGET_CODE)
                .status(Agent.Status.ACTIVE).tier(Agent.Tier.STANDARD)
                .floatLimit(floatLimit == null ? null : new BigDecimal(floatLimit))
                .build();
    }

    private Wallet wallet(UUID userId, String balance) {
        return Wallet.builder().userId(userId).balance(new BigDecimal(balance))
                .currency("GHS").frozen(false).build();
    }

    /** Wires the common stubs for a successful distribution. */
    private void stubHappyPath(Agent superAgent, Agent target, Wallet superWallet, Wallet targetWallet) {
        when(agentRepository.findByUserId(superUserId)).thenReturn(Optional.of(superAgent));
        when(agentRepository.findByUserId(targetUserId)).thenReturn(Optional.of(target));
        when(agentRepository.findByCode(TARGET_CODE)).thenReturn(Optional.of(target));
        when(walletRepository.findByUserIdAndTypeForUpdate(superUserId, Wallet.WalletType.AGENT_FLOAT)).thenReturn(Optional.of(superWallet));
        when(walletRepository.findByUserIdAndTypeForUpdate(targetUserId, Wallet.WalletType.AGENT_FLOAT)).thenReturn(Optional.of(targetWallet));
        when(walletRepository.findByUserIdAndType(superUserId, Wallet.WalletType.AGENT_FLOAT)).thenReturn(Optional.of(superWallet));
        when(userRepository.findById(targetUserId)).thenReturn(Optional.of(User.builder().id(targetUserId).firstName("Ama").build()));
        when(transactionRepository.save(any(Transaction.class))).thenAnswer(inv -> {
            Transaction t = inv.getArgument(0);
            if (t.getId() == null) t.setId(UUID.randomUUID());
            return t;
        });
    }

    @Test
    void distribute_movesFloatBetweenWallets_withNoMargin() {
        Agent superAgent = superAgent();
        Agent target = targetAgent(null);
        Wallet superWallet = wallet(superUserId, "1000.00");
        Wallet targetWallet = wallet(targetUserId, "50.00");
        stubHappyPath(superAgent, target, superWallet, targetWallet);

        FloatDistributionResponse res = service.distribute(superUser(), TARGET_CODE, new BigDecimal("300.00"), null);

        assertEquals(new BigDecimal("700.00"), superWallet.getBalance());   // superagent float reduced
        assertEquals(new BigDecimal("350.00"), targetWallet.getBalance());  // agent float credited
        assertEquals(BigDecimal.ZERO, superAgent.getCommissionAccruedGhs()); // distribution earns no margin
        assertEquals(TARGET_CODE, res.getTargetAgentCode());

        verify(transactionRepository).save(argThat(t ->
                t.getType() == Transaction.TransactionType.FLOAT_DISTRIBUTION
                        && t.getSenderId().equals(superUserId)
                        && t.getRecipientId().equals(targetUserId)));
    }

    @Test
    void distribute_rejectsNonSuperTier() {
        Agent standard = superAgent();
        standard.setTier(Agent.Tier.STANDARD);
        when(agentRepository.findByUserId(superUserId)).thenReturn(Optional.of(standard));

        AppException ex = assertThrows(AppException.class,
                () -> service.distribute(superUser(), TARGET_CODE, new BigDecimal("100.00"), null));
        assertEquals("NOT_A_SUPERAGENT", ex.getCode());
        verify(transactionRepository, never()).save(any());
    }

    @Test
    void distribute_rejectsInsufficientFloat() {
        Agent superAgent = superAgent();
        Agent target = targetAgent(null);
        Wallet superWallet = wallet(superUserId, "100.00");
        Wallet targetWallet = wallet(targetUserId, "0.00");
        stubHappyPath(superAgent, target, superWallet, targetWallet);

        AppException ex = assertThrows(AppException.class,
                () -> service.distribute(superUser(), TARGET_CODE, new BigDecimal("500.00"), null));
        assertEquals("INSUFFICIENT_FLOAT", ex.getCode());
        verify(transactionRepository, never()).save(any());
    }

    @Test
    void distribute_enforcesTargetFloatLimit() {
        Agent superAgent = superAgent();
        Agent target = targetAgent("400.00");           // agent may hold at most 400
        Wallet superWallet = wallet(superUserId, "1000.00");
        Wallet targetWallet = wallet(targetUserId, "300.00"); // 300 + 200 = 500 > 400
        stubHappyPath(superAgent, target, superWallet, targetWallet);

        AppException ex = assertThrows(AppException.class,
                () -> service.distribute(superUser(), TARGET_CODE, new BigDecimal("200.00"), null));
        assertEquals("FLOAT_LIMIT_EXCEEDED", ex.getCode());
        verify(transactionRepository, never()).save(any());
    }

    @Test
    void distribute_rejectsSelfDistribution() {
        Agent superAgent = superAgent();
        Agent selfTarget = targetAgent(null);
        selfTarget.setUserId(superUserId);              // target resolves to the caller
        when(agentRepository.findByUserId(superUserId)).thenReturn(Optional.of(superAgent));
        when(agentRepository.findByCode(TARGET_CODE)).thenReturn(Optional.of(selfTarget));

        AppException ex = assertThrows(AppException.class,
                () -> service.distribute(superUser(), TARGET_CODE, new BigDecimal("100.00"), null));
        assertEquals("INVALID_TARGET", ex.getCode());
        verify(transactionRepository, never()).save(any());
    }

    @Test
    void distribute_isIdempotent() {
        Transaction existing = Transaction.builder()
                .id(UUID.randomUUID()).senderId(superUserId).recipientId(targetUserId)
                .amount(new BigDecimal("120.00")).type(Transaction.TransactionType.FLOAT_DISTRIBUTION)
                .build();
        when(transactionRepository.findByIdempotencyKey("key-1")).thenReturn(Optional.of(existing));
        when(agentRepository.findByUserId(superUserId)).thenReturn(Optional.of(superAgent()));
        when(agentRepository.findByUserId(targetUserId)).thenReturn(Optional.of(targetAgent(null)));
        when(walletRepository.findByUserIdAndType(superUserId, Wallet.WalletType.AGENT_FLOAT)).thenReturn(Optional.of(wallet(superUserId, "880.00")));
        when(userRepository.findById(targetUserId)).thenReturn(Optional.of(User.builder().id(targetUserId).firstName("Ama").build()));

        FloatDistributionResponse res = service.distribute(superUser(), TARGET_CODE, new BigDecimal("120.00"), "key-1");

        assertEquals(existing.getId().toString(), res.getTransactionId());
        verify(transactionRepository, never()).save(any());           // no second ledger entry
        verify(walletRepository, never()).findByUserIdAndTypeForUpdate(any(), any()); // no balance moves
    }
}
