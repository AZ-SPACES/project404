package com.aza.backend.service;

import com.aza.backend.entity.Agent;
import com.aza.backend.entity.AgentCommissionSettlement;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.AgentCommissionSettlementRepository;
import com.aza.backend.repository.AgentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Settles the commission AZA owes an agent. The payout itself happens out of band
 * (a bank disbursement); this service only records it and reduces the accrued payable
 * on the {@link Agent}. It never touches a wallet, so no e-money is created and the
 * safeguarding invariant holds. Runs only via the maker-checker SETTLE_COMMISSION
 * approval, so one staff member can never pay out commission alone.
 */
@Service
@RequiredArgsConstructor
public class AgentCommissionService {

    private final AgentRepository agentRepository;
    private final AgentCommissionSettlementRepository settlementRepository;

    @Transactional
    public AgentCommissionSettlement settle(User admin, UUID agentId, BigDecimal amount, String bankReference) {
        if (amount == null || amount.signum() <= 0) {
            throw new AppException("INVALID_AMOUNT", "Amount must be greater than zero", HttpStatus.BAD_REQUEST);
        }
        Agent agent = agentRepository.findById(agentId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Agent not found", HttpStatus.NOT_FOUND));
        if (amount.compareTo(agent.getCommissionAccruedGhs()) > 0) {
            throw new AppException("COMMISSION_EXCEEDS_ACCRUED",
                    "Settlement of GHS " + amount.toPlainString() + " exceeds the agent's accrued commission of GHS "
                            + agent.getCommissionAccruedGhs().toPlainString(), HttpStatus.CONFLICT);
        }

        agent.setCommissionAccruedGhs(agent.getCommissionAccruedGhs().subtract(amount));
        agentRepository.save(agent);

        return settlementRepository.save(AgentCommissionSettlement.builder()
                .agentId(agentId)
                .amount(amount)
                .bankReference(bankReference)
                .performedBy(admin != null ? admin.getId() : null)
                .build());
    }

    public Page<AgentCommissionSettlement> list(int page, int size) {
        return settlementRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(page, Math.min(size, 100)));
    }
}
