package com.aza.backend.service;

import com.aza.backend.dto.agent.AgentApplyRequest;
import com.aza.backend.dto.agent.AgentResponse;
import com.aza.backend.dto.agent.AgentTermsRequest;
import com.aza.backend.entity.Agent;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.AgentRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.repository.WalletRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AgentServiceTest {

    private final AgentRepository agentRepository = mock(AgentRepository.class);
    private final WalletRepository walletRepository = mock(WalletRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final NotificationService notificationService = mock(NotificationService.class);
    private final AgentService service = new AgentService(
            agentRepository, walletRepository, userRepository, notificationService);

    private final UUID userId = UUID.randomUUID();
    private final UUID agentId = UUID.randomUUID();

    private User user() { return User.builder().id(userId).kycStatus(User.KycStatus.VERIFIED).build(); }

    private void echoSaveWithId() {
        when(agentRepository.save(any(Agent.class))).thenAnswer(inv -> {
            Agent a = inv.getArgument(0);
            if (a.getId() == null) a.setId(UUID.randomUUID());
            return a;
        });
    }

    @Test
    void apply_createsPendingAgent() {
        when(agentRepository.findByUserId(userId)).thenReturn(Optional.empty());
        echoSaveWithId();

        AgentApplyRequest req = new AgentApplyRequest();
        req.setLocation("Kumasi Central Market");
        AgentResponse res = service.apply(user(), req);

        assertEquals("PENDING", res.getStatus());
        verify(agentRepository).save(argThat(a ->
                a.getStatus() == Agent.Status.PENDING
                        && "Kumasi Central Market".equals(a.getLocation())
                        && a.getUserId().equals(userId)));
    }

    @Test
    void apply_rejectsUnverifiedKyc() {
        User unverified = User.builder().id(userId).kycStatus(User.KycStatus.NOT_STARTED).build();

        AppException ex = assertThrows(AppException.class, () -> service.apply(unverified, new AgentApplyRequest()));
        assertEquals("KYC_REQUIRED", ex.getCode());
        verify(agentRepository, never()).save(any());
    }

    @Test
    void updateTerms_appliesProvidedFieldsAndLeavesOthers() {
        Agent agent = Agent.builder().id(agentId).userId(userId).status(Agent.Status.ACTIVE)
                .tier(Agent.Tier.STANDARD).cashInCommissionBps(20).cashOutCommissionShareBps(5000).build();
        when(agentRepository.findById(agentId)).thenReturn(Optional.of(agent));
        echoSaveWithId();

        AgentTermsRequest req = new AgentTermsRequest();
        req.setTier("SUPER");
        req.setFloatLimit(new BigDecimal("50000"));
        req.setCashInCommissionBps(30);
        service.updateTerms(agentId, req);

        assertEquals(Agent.Tier.SUPER, agent.getTier());
        assertEquals(new BigDecimal("50000"), agent.getFloatLimit());
        assertEquals(30, agent.getCashInCommissionBps());
        assertEquals(5000, agent.getCashOutCommissionShareBps()); // untouched
    }

    @Test
    void updateTerms_rejectsOutOfRangeBps() {
        Agent agent = Agent.builder().id(agentId).userId(userId).build();
        when(agentRepository.findById(agentId)).thenReturn(Optional.of(agent));

        AgentTermsRequest req = new AgentTermsRequest();
        req.setCashInCommissionBps(20_000);
        AppException ex = assertThrows(AppException.class, () -> service.updateTerms(agentId, req));
        assertEquals("INVALID_BPS", ex.getCode());
    }

    @Test
    void apply_rejectsDuplicate() {
        when(agentRepository.findByUserId(userId))
                .thenReturn(Optional.of(Agent.builder().id(agentId).userId(userId).build()));

        AppException ex = assertThrows(AppException.class, () -> service.apply(user(), new AgentApplyRequest()));
        assertTrue(ex.getMessage().toLowerCase().contains("already"));
        verify(agentRepository, never()).save(any());
    }

    @Test
    void activate_setsActive() {
        Agent agent = Agent.builder().id(agentId).userId(userId).status(Agent.Status.PENDING).build();
        when(agentRepository.findById(agentId)).thenReturn(Optional.of(agent));
        echoSaveWithId();

        service.activate(agentId);

        assertEquals(Agent.Status.ACTIVE, agent.getStatus());
    }

    @Test
    void reject_setsRejected() {
        Agent agent = Agent.builder().id(agentId).userId(userId).status(Agent.Status.PENDING).build();
        when(agentRepository.findById(agentId)).thenReturn(Optional.of(agent));
        echoSaveWithId();

        AgentResponse res = service.reject(agentId);

        assertEquals("REJECTED", res.getStatus());
        assertEquals(Agent.Status.REJECTED, agent.getStatus());
    }
}
