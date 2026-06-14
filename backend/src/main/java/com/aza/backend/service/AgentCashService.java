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
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.Optional;

/**
 * Agent cash network. A cash-in moves wallet balance from the agent's float (their
 * primary wallet) to the customer's wallet — an internal transfer, so no e-money is
 * minted and the safeguarding invariant holds. Cash-in is free to the customer;
 * AZA's commission to the agent accrues as a payable on the {@link Agent}.
 */
@Service
@RequiredArgsConstructor
public class AgentCashService {

    private static final BigDecimal MIN_CASH_IN_COMMISSION = new BigDecimal("0.10");

    private final AgentRepository agentRepository;
    private final WalletRepository walletRepository;
    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    private final FeeCalculationService feeCalculationService;
    private final WithdrawalCodeService withdrawalCodeService;

    /**
     * Agent hands the customer's deposit into the app: {@code amount} moves from the
     * agent's float wallet to the customer's wallet. Idempotent on {@code idempotencyKey}.
     */
    @Transactional
    public AgentCashResponse cashIn(User agentUser, String customerIdentifier,
                                    BigDecimal amount, String idempotencyKey) {
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            Optional<Transaction> existing = transactionRepository.findByIdempotencyKey(idempotencyKey);
            if (existing.isPresent()) {
                return toResponse(existing.get(), agentForUser(agentUser));
            }
        }
        if (amount == null || amount.signum() <= 0) {
            throw new AppException("INVALID_AMOUNT", "Amount must be greater than zero", HttpStatus.BAD_REQUEST);
        }

        Agent agent = agentForUser(agentUser);
        if (agent.getStatus() != Agent.Status.ACTIVE) {
            throw new AppException("AGENT_NOT_ACTIVE", "Agent account is not active", HttpStatus.FORBIDDEN);
        }

        User customer = resolveCustomer(customerIdentifier);
        if (customer.getId().equals(agentUser.getId())) {
            throw new AppException("INVALID_CUSTOMER", "An agent cannot cash in to their own wallet", HttpStatus.BAD_REQUEST);
        }

        // Lock both wallets. The agent's primary wallet is their float.
        Wallet agentWallet = walletRepository.findByUserIdForUpdate(agentUser.getId())
                .orElseThrow(() -> new AppException("Agent wallet not found"));
        if (Boolean.TRUE.equals(agentWallet.getFrozen())) {
            throw new AppException("WALLET_FROZEN", "Agent wallet is frozen", HttpStatus.FORBIDDEN);
        }
        if (agentWallet.getBalance().compareTo(amount) < 0) {
            throw new AppException("INSUFFICIENT_FLOAT",
                    "Agent float is too low for this deposit", HttpStatus.BAD_REQUEST);
        }
        Wallet customerWallet = walletRepository.findByUserIdForUpdate(customer.getId())
                .orElseThrow(() -> new AppException("Customer wallet not found"));

        // Move float -> customer (cash-in is free to the customer).
        agentWallet.setBalance(agentWallet.getBalance().subtract(amount));
        customerWallet.setBalance(customerWallet.getBalance().add(amount));
        walletRepository.save(agentWallet);
        walletRepository.save(customerWallet);

        agentUser.setBalance(agentWallet.getBalance());
        userRepository.save(agentUser);
        customer.setBalance(customerWallet.getBalance());
        userRepository.save(customer);

        // Accrue AZA's cash-in commission to the agent (payable, not e-money).
        BigDecimal commission = cashInCommission(agent, amount);
        agent.setCommissionAccruedGhs(agent.getCommissionAccruedGhs().add(commission));
        agentRepository.save(agent);

        Transaction tx = transactionRepository.save(Transaction.builder()
                .senderId(agentUser.getId())
                .recipientId(customer.getId())
                .amount(amount)
                .type(Transaction.TransactionType.CASH_IN)
                .status(Transaction.TransactionStatus.COMPLETED)
                .feeAmount(BigDecimal.ZERO)
                .idempotencyKey(idempotencyKey != null && !idempotencyKey.isBlank() ? idempotencyKey : null)
                .completedAt(LocalDateTime.now())
                .note("Cash deposit via agent")
                .build());

        return toResponse(tx, agent);
    }

    /**
     * Agent redeems a customer's one-time code and hands over cash. The customer wallet
     * is debited amount + fee; the agent float is credited amount + their commission
     * share of the fee. The remainder of the fee (AZA's share) leaves circulation as
     * revenue. Idempotent on {@code idempotencyKey}.
     */
    @Transactional
    public AgentCashResponse cashOut(User agentUser, String code, String idempotencyKey) {
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            Optional<Transaction> existing = transactionRepository.findByIdempotencyKey(idempotencyKey);
            if (existing.isPresent()) {
                return toResponse(existing.get(), agentForUser(agentUser));
            }
        }

        Agent agent = agentForUser(agentUser);
        if (agent.getStatus() != Agent.Status.ACTIVE) {
            throw new AppException("AGENT_NOT_ACTIVE", "Agent account is not active", HttpStatus.FORBIDDEN);
        }

        // Validate + mark the code redeemed; rolls back with this transaction if the move fails.
        WithdrawalCode redeemed = withdrawalCodeService.consume(code, agentUser.getId());
        BigDecimal amount = redeemed.getAmount();

        User customer = userRepository.findById(redeemed.getUserId())
                .orElseThrow(() -> new AppException("Customer not found"));

        BigDecimal fee = feeCalculationService.quote("CASH_OUT", amount, customer.getId()).fee();
        BigDecimal agentShare = fee
                .multiply(BigDecimal.valueOf(agent.getCashOutCommissionShareBps()))
                .divide(BigDecimal.valueOf(10_000), 2, RoundingMode.HALF_UP);

        Wallet customerWallet = walletRepository.findByUserIdForUpdate(customer.getId())
                .orElseThrow(() -> new AppException("Customer wallet not found"));
        if (Boolean.TRUE.equals(customerWallet.getFrozen())) {
            throw new AppException("WALLET_FROZEN", "Customer wallet is frozen", HttpStatus.FORBIDDEN);
        }
        BigDecimal totalDebit = amount.add(fee);
        if (customerWallet.getBalance().compareTo(totalDebit) < 0) {
            throw new AppException("INSUFFICIENT_FUNDS",
                    "Customer balance is too low for this withdrawal plus its fee", HttpStatus.BAD_REQUEST);
        }
        Wallet agentWallet = walletRepository.findByUserIdForUpdate(agentUser.getId())
                .orElseThrow(() -> new AppException("Agent wallet not found"));

        customerWallet.setBalance(customerWallet.getBalance().subtract(totalDebit));
        agentWallet.setBalance(agentWallet.getBalance().add(amount).add(agentShare));
        walletRepository.save(customerWallet);
        walletRepository.save(agentWallet);

        customer.setBalance(customerWallet.getBalance());
        userRepository.save(customer);
        agentUser.setBalance(agentWallet.getBalance());
        userRepository.save(agentUser);

        Transaction tx = transactionRepository.save(Transaction.builder()
                .senderId(customer.getId())
                .recipientId(agentUser.getId())
                .amount(amount)
                .type(Transaction.TransactionType.CASH_OUT)
                .status(Transaction.TransactionStatus.COMPLETED)
                .feeAmount(fee)
                .idempotencyKey(idempotencyKey != null && !idempotencyKey.isBlank() ? idempotencyKey : null)
                .completedAt(LocalDateTime.now())
                .note("Cash withdrawal via agent")
                .build());

        return toResponse(tx, agent);
    }

    private BigDecimal cashInCommission(Agent agent, BigDecimal amount) {
        BigDecimal rate = BigDecimal.valueOf(agent.getCashInCommissionBps())
                .divide(BigDecimal.valueOf(10_000), 6, RoundingMode.HALF_UP);
        return amount.multiply(rate).setScale(2, RoundingMode.HALF_UP).max(MIN_CASH_IN_COMMISSION);
    }

    private Agent agentForUser(User agentUser) {
        return agentRepository.findByUserId(agentUser.getId())
                .orElseThrow(() -> new AppException("NOT_AN_AGENT",
                        "This account is not registered as an agent", HttpStatus.FORBIDDEN));
    }

    private User resolveCustomer(String identifier) {
        if (identifier == null || identifier.isBlank()) {
            throw new AppException("INVALID_CUSTOMER", "A customer identifier is required", HttpStatus.BAD_REQUEST);
        }
        String candidate = identifier.startsWith("@") ? identifier.substring(1) : identifier;
        return userRepository.findByEmailOrPhoneNumber(identifier, identifier)
                .or(() -> userRepository.findByUsername(candidate))
                .orElseThrow(() -> new AppException("CUSTOMER_NOT_FOUND", "Customer not found", HttpStatus.NOT_FOUND));
    }

    private AgentCashResponse toResponse(Transaction tx, Agent agent) {
        BigDecimal floatBalance = walletRepository.findByUserId(agent.getUserId())
                .map(Wallet::getBalance).orElse(BigDecimal.ZERO);
        return AgentCashResponse.builder()
                .transactionId(tx.getId().toString())
                .type(tx.getType().name())
                .amount(tx.getAmount())
                .fee(tx.getFeeAmount() != null ? tx.getFeeAmount() : BigDecimal.ZERO)
                .commissionAccrued(agent.getCommissionAccruedGhs())
                .agentFloatBalance(floatBalance)
                .customerId(tx.getRecipientId().toString())
                .currency("GHS")
                .build();
    }
}
