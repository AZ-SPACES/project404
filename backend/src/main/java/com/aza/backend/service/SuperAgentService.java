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
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

/**
 * Tiered float distribution. A SUPER-tier agent ("superagent") is the bank to ordinary
 * agents: serving an agent moves e-float from the superagent's float wallet to the agent's
 * float wallet — an internal transfer, so no e-money is minted and the safeguarding
 * invariant holds. New e-money enters only at the bank boundary ({@link FloatService#mint}).
 * The superagent's distribution margin accrues as a payable on the {@link Agent} (not e-money).
 */
@Service
@RequiredArgsConstructor
public class SuperAgentService {

    private final AgentRepository agentRepository;
    private final WalletRepository walletRepository;
    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;

    /**
     * Superagent hands an agent e-float against the physical cash the agent gives them:
     * {@code amount} moves from the superagent's float wallet to the target agent's float
     * wallet. Idempotent on {@code idempotencyKey}.
     */
    @Transactional
    public FloatDistributionResponse distribute(User superUser, String targetAgentCode,
                                                BigDecimal amount, String idempotencyKey) {
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            Optional<Transaction> existing = transactionRepository.findByIdempotencyKey(idempotencyKey);
            if (existing.isPresent()) {
                return toResponse(existing.get(), superForUser(superUser));
            }
        }
        if (amount == null || amount.signum() <= 0) {
            throw new AppException("INVALID_AMOUNT", "Amount must be greater than zero", HttpStatus.BAD_REQUEST);
        }

        Agent superAgent = superForUser(superUser);
        if (superAgent.getStatus() != Agent.Status.ACTIVE) {
            throw new AppException("AGENT_NOT_ACTIVE", "Superagent account is not active", HttpStatus.FORBIDDEN);
        }
        if (superAgent.getTier() != Agent.Tier.SUPER) {
            throw new AppException("NOT_A_SUPERAGENT",
                    "Only a superagent can distribute float to agents", HttpStatus.FORBIDDEN);
        }

        Agent target = resolveTargetAgent(targetAgentCode);
        if (target.getUserId().equals(superUser.getId())) {
            throw new AppException("INVALID_TARGET", "A superagent cannot distribute float to themselves", HttpStatus.BAD_REQUEST);
        }
        if (target.getStatus() != Agent.Status.ACTIVE) {
            throw new AppException("TARGET_NOT_ACTIVE", "The target agent is not active", HttpStatus.CONFLICT);
        }

        // Lock both float wallets in a deterministic order (ascending owner id) so two
        // concurrent distributions over the same pair can never deadlock.
        WalletPair pair = lockFloats(superUser.getId(), target.getUserId());
        Wallet superWallet = pair.superWallet();
        Wallet targetWallet = pair.targetWallet();

        if (Boolean.TRUE.equals(superWallet.getFrozen())) {
            throw new AppException("WALLET_FROZEN", "Superagent float wallet is frozen", HttpStatus.FORBIDDEN);
        }
        if (superWallet.getBalance().compareTo(amount) < 0) {
            throw new AppException("INSUFFICIENT_FLOAT",
                    "Superagent float is too low for this distribution", HttpStatus.BAD_REQUEST);
        }

        // Distribution grows the agent's float; keep it within their float limit if one is set.
        BigDecimal targetNewBalance = targetWallet.getBalance().add(amount);
        if (target.getFloatLimit() != null && targetNewBalance.compareTo(target.getFloatLimit()) > 0) {
            throw new AppException("FLOAT_LIMIT_EXCEEDED",
                    "This distribution would push the agent's float above their limit of GHS "
                            + target.getFloatLimit().toPlainString(), HttpStatus.CONFLICT);
        }

        // Move float superagent -> agent (internal transfer, no e-money minted).
        superWallet.setBalance(superWallet.getBalance().subtract(amount));
        targetWallet.setBalance(targetNewBalance);
        walletRepository.save(superWallet);
        walletRepository.save(targetWallet);

        Transaction tx = transactionRepository.save(Transaction.builder()
                .senderId(superUser.getId())
                .recipientId(target.getUserId())
                .amount(amount)
                .type(Transaction.TransactionType.FLOAT_DISTRIBUTION)
                .status(Transaction.TransactionStatus.COMPLETED)
                .feeAmount(BigDecimal.ZERO)
                .idempotencyKey(idempotencyKey != null && !idempotencyKey.isBlank() ? idempotencyKey : null)
                .completedAt(LocalDateTime.now())
                .note("Float distributed to agent " + target.getCode())
                .build());

        return toResponse(tx, superAgent);
    }

    /** Paged distribution history for the calling superagent. */
    public Page<FloatDistributionResponse> distributions(User superUser, int page, int size) {
        Agent superAgent = superForUser(superUser);
        return transactionRepository
                .findFloatDistributions(superUser.getId(), PageRequest.of(page, Math.min(size, 50)))
                .map(tx -> toResponse(tx, superAgent));
    }

    private WalletPair lockFloats(UUID superUserId, UUID targetUserId) {
        Wallet superWallet;
        Wallet targetWallet;
        if (superUserId.compareTo(targetUserId) < 0) {
            superWallet = lockFloat(superUserId, "Superagent float wallet not found");
            targetWallet = lockFloat(targetUserId, "Target agent float wallet not found");
        } else {
            targetWallet = lockFloat(targetUserId, "Target agent float wallet not found");
            superWallet = lockFloat(superUserId, "Superagent float wallet not found");
        }
        return new WalletPair(superWallet, targetWallet);
    }

    private Wallet lockFloat(UUID userId, String missingMessage) {
        return walletRepository.findByUserIdAndTypeForUpdate(userId, Wallet.WalletType.AGENT_FLOAT)
                .orElseThrow(() -> new AppException("AGENT_FLOAT_MISSING", missingMessage, HttpStatus.CONFLICT));
    }

    private record WalletPair(Wallet superWallet, Wallet targetWallet) {}

    private Agent superForUser(User superUser) {
        return agentRepository.findByUserId(superUser.getId())
                .orElseThrow(() -> new AppException("NOT_AN_AGENT",
                        "This account is not registered as an agent", HttpStatus.FORBIDDEN));
    }

    private Agent resolveTargetAgent(String code) {
        if (code == null || code.isBlank()) {
            throw new AppException("INVALID_TARGET", "A target agent code is required", HttpStatus.BAD_REQUEST);
        }
        return agentRepository.findByCode(code.trim().toUpperCase())
                .orElseThrow(() -> new AppException("AGENT_NOT_FOUND", "No agent with that code", HttpStatus.NOT_FOUND));
    }

    private FloatDistributionResponse toResponse(Transaction tx, Agent superAgent) {
        BigDecimal floatBalance = walletRepository
                .findByUserIdAndType(superAgent.getUserId(), Wallet.WalletType.AGENT_FLOAT)
                .map(Wallet::getBalance).orElse(BigDecimal.ZERO);
        String targetCode = agentRepository.findByUserId(tx.getRecipientId()).map(Agent::getCode).orElse(null);
        String targetName = userRepository.findById(tx.getRecipientId()).map(u -> {
            String full = ((u.getFirstName() != null ? u.getFirstName() : "") + " "
                    + (u.getLastName() != null ? u.getLastName() : "")).trim();
            return full.isBlank() ? u.getUsername() : full;
        }).orElse(null);
        return FloatDistributionResponse.builder()
                .transactionId(tx.getId().toString())
                .amount(tx.getAmount())
                .superAgentFloatBalance(floatBalance)
                .targetAgentCode(targetCode)
                .targetAgentName(targetName)
                .currency("GHS")
                .build();
    }
}
