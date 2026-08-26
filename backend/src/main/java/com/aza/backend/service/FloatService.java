package com.aza.backend.service;

import com.aza.backend.entity.Agent;
import com.aza.backend.entity.FloatMovement;
import com.aza.backend.entity.User;
import com.aza.backend.entity.Wallet;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.AgentRepository;
import com.aza.backend.repository.FloatMovementRepository;
import com.aza.backend.repository.WalletRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Float lifecycle. Mint creates e-money in an agent's float wallet against a verified
 * bank deposit; burn removes it when bank money is wired out. Both run only via the
 * maker-checker MINT_FLOAT / BURN_FLOAT approvals, so a single staff member can never
 * create or destroy e-money. The agent's float is their primary wallet.
 */
@Service
@RequiredArgsConstructor
public class FloatService {

    private final AgentRepository agentRepository;
    private final WalletRepository walletRepository;
    private final FloatMovementRepository floatMovementRepository;
    private final WalletLedger walletLedger;

    @Transactional
    public FloatMovement mint(User admin, UUID agentId, BigDecimal amount, String bankReference) {
        validateAmount(amount);
        requireUnusedBankReference(FloatMovement.Type.MINT, bankReference);
        Agent agent = requireAgent(agentId);
        if (agent.getStatus() != Agent.Status.ACTIVE) {
            throw new AppException("AGENT_NOT_ACTIVE", "Float can only be minted to an active agent", HttpStatus.CONFLICT);
        }
        Wallet wallet = lockWallet(agent);

        BigDecimal newBalance = wallet.getBalance().add(amount);
        if (agent.getFloatLimit() != null && newBalance.compareTo(agent.getFloatLimit()) > 0) {
            throw new AppException("FLOAT_LIMIT_EXCEEDED",
                    "Minting would exceed the agent's float limit of GHS " + agent.getFloatLimit().toPlainString(),
                    HttpStatus.CONFLICT);
        }
        walletLedger.creditLocked(wallet, amount);
        return record(agent, FloatMovement.Type.MINT, amount, bankReference, admin);
    }

    @Transactional
    public FloatMovement burn(User admin, UUID agentId, BigDecimal amount, String bankReference) {
        validateAmount(amount);
        requireUnusedBankReference(FloatMovement.Type.BURN, bankReference);
        Agent agent = requireAgent(agentId);
        Wallet wallet = lockWallet(agent);

        if (wallet.getBalance().compareTo(amount) < 0) {
            throw new AppException("INSUFFICIENT_FLOAT",
                    "Agent float is too low to burn this amount", HttpStatus.BAD_REQUEST);
        }
        walletLedger.debitLocked(wallet, amount);
        return record(agent, FloatMovement.Type.BURN, amount, bankReference, admin);
    }

    public Page<FloatMovement> list(int page, int size) {
        return floatMovementRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(page, Math.min(size, 100)));
    }

    private FloatMovement record(Agent agent, FloatMovement.Type type, BigDecimal amount,
                                 String bankReference, User admin) {
        return floatMovementRepository.save(FloatMovement.builder()
                .agentId(agent.getId())
                .type(type)
                .amount(amount)
                .bankReference(bankReference != null ? bankReference.trim() : null)
                .performedBy(admin != null ? admin.getId() : null)
                .build());
    }

    /**
     * The bank transaction is the idempotency key for e-money issuance.
     *
     * <p>Mint is the only place e-money is created, so a deposit that is minted twice puts
     * issued e-money above the safeguarded balance. Maker-checker does not catch it: two
     * approvals raised for the same deposit are two legitimate approvals. The reference is
     * therefore mandatory and single-use, enforced here for a readable error and by the
     * partial unique index in V60 for the case where two approvals commit at once.
     */
    private void requireUnusedBankReference(FloatMovement.Type type, String bankReference) {
        if (bankReference == null || bankReference.isBlank()) {
            throw new AppException("BANK_REFERENCE_REQUIRED",
                    "A bank reference is required: e-money is only created or destroyed against a "
                            + "real bank transaction", HttpStatus.BAD_REQUEST);
        }
        if (floatMovementRepository.existsByTypeAndBankReference(type, bankReference.trim())) {
            throw new AppException("BANK_REFERENCE_ALREADY_USED",
                    "That bank reference has already been " + (type == FloatMovement.Type.MINT ? "minted" : "burned")
                            + ". Issuing against it again would put e-money above the safeguarded balance.",
                    HttpStatus.CONFLICT);
        }
    }

    private Agent requireAgent(UUID agentId) {
        return agentRepository.findById(agentId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Agent not found", HttpStatus.NOT_FOUND));
    }

    private Wallet lockWallet(Agent agent) {
        return walletRepository.findByUserIdAndTypeForUpdate(agent.getUserId(), Wallet.WalletType.AGENT_FLOAT)
                .orElseThrow(() -> new AppException("AGENT_FLOAT_MISSING",
                        "Agent float wallet not found", HttpStatus.CONFLICT));
    }

    private void validateAmount(BigDecimal amount) {
        if (amount == null || amount.signum() <= 0) {
            throw new AppException("INVALID_AMOUNT", "Amount must be greater than zero", HttpStatus.BAD_REQUEST);
        }
    }
}
