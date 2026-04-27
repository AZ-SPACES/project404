package com.aza.backend.service;

import com.aza.backend.dto.transfer.*;
import com.aza.backend.entity.Transaction;
import com.aza.backend.entity.User;
import com.aza.backend.entity.Wallet;
import com.aza.backend.repository.TransactionRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.repository.WalletRepository;
import com.aza.backend.util.RateLimitService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TransferService {

    private final TransactionRepository transactionRepository;
    private final WalletRepository walletRepository;
    private final UserRepository userRepository;
    private final UserService userService;
    private final RateLimitService rateLimitService;

    @Value("${transfer.max-single-amount:10000}")
    private BigDecimal maxSingleAmount;

    @Value("${transfer.max-daily-amount:50000}")
    private BigDecimal maxDailyAmount;

    // WALLET

    public WalletResponse getBalance(UUID userId) {
        Wallet wallet = walletRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("Wallet not found"));

        return WalletResponse.builder()
                .balance(wallet.getBalance())
                .currency(wallet.getCurrency())
                .lastUpdatedAt(wallet.getLastUpdatedAt() != null
                        ? wallet.getLastUpdatedAt().toString() : null)
                .build();
    }

    // INITIATE TRANSFER

    @Transactional
    public TransferResponse initiateTransfer(User sender, TransferRequest request) {
        Optional<Transaction> existing = transactionRepository
                .findByIdempotencyKey(request.getIdempotencyKey());
        if (existing.isPresent()) {
            Transaction t = existing.get();
            if(!t.getSenderId().equals(sender.getId())) {
                throw new RuntimeException("Invalid idempotency key");
            }
            User recipient = userRepository.findById(t.getRecipientId()).orElse(null);
            return buildTransferResponse(t, sender, recipient);
        }
        rateLimitService.enforceRateLimit("transfer:" + sender.getId(), 20, Duration.ofHours(1));

        if(sender.getStatus() != User.AccountStatus.ACTIVE) {
            throw new RuntimeException("Your account is not active");
        }

        if(sender.getKycStatus() !=User.KycStatus.VERIFIED) {
            throw new RuntimeException("KYC verification required before transfer");
        }

        if(request.getAmount().compareTo(maxSingleAmount) > 0) {
            throw new RuntimeException("Amount exceeds max single transfer limit of GHS " + maxSingleAmount);
        }

        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        LocalDateTime endOfDay = startOfDay.plusDays(1);
        BigDecimal todayTotal = transactionRepository.getTotalSentToday(
                sender.getId(), startOfDay, endOfDay
        );
        if (todayTotal.add(request.getAmount()).compareTo(maxDailyAmount) > 0) {
            BigDecimal remaining = maxDailyAmount.subtract(todayTotal);
            throw new RuntimeException("Transfer would exceed your daily limit. Remaining: GHS " + remaining);
        }

        // 2. Find recipient
        User recipient = userRepository
                .findByEmailOrPhone(request.getRecipientIdentifier(), request.getRecipientIdentifier())
                .orElseThrow(() -> new RuntimeException("Recipient not found"));

        if (recipient.getId().equals(sender.getId())) {
            throw new RuntimeException("Cannot transfer to yourself");
        }

        if (recipient.getStatus() != User.AccountStatus.ACTIVE) {
            throw new RuntimeException("Recipient account is not available");
        }

        // 3. Check sender balance
        Wallet senderWallet = walletRepository.findByUserId(sender.getId())
                .orElseThrow(() -> new RuntimeException("Wallet not found"));

        if (senderWallet.getBalance().compareTo(request.getAmount()) < 0) {
            throw new RuntimeException("Insufficient balance");
        }

        // 4. Create pending transaction
        Transaction transaction = Transaction.builder()
                .senderId(sender.getId())
                .recipientId(recipient.getId())
                .amount(request.getAmount())
                .note(request.getNote())
                .type(Transaction.TransactionType.TRANSFER)
                .status(Transaction.TransactionStatus.PENDING)
                .idempotencyKey(request.getIdempotencyKey())
                .expiresAt(LocalDateTime.now().plusMinutes(10))
                .build();

        transaction = transactionRepository.save(transaction);
        return buildTransferResponse(transaction, sender, recipient);
    }

    // ==================== CONFIRM TRANSFER (with PIN) ====================

    @Transactional
    public TransferResponse confirmTransfer(User sender, UUID transactionId, String passcode) {
        if (sender.getStatus() != User.AccountStatus.ACTIVE) {
            throw new RuntimeException("Your account is not active");
        }
        //Verify passcode
        userService.verifyPasscode(sender, passcode);

        // Find the pending transaction
        Transaction transaction = transactionRepository.findById(transactionId)
                .orElseThrow(() -> new RuntimeException("Transaction not found"));

        if (!transaction.getSenderId().equals(sender.getId())) {
            throw new RuntimeException("Not authorized to confirm this transaction");
        }
        if (transaction.getStatus() == Transaction.TransactionStatus.COMPLETED) {
            User recipient = userRepository.findById(transaction.getRecipientId()).orElse(null);
            return buildTransferResponse(transaction, sender, recipient);
        }
        if (transaction.getStatus() != Transaction.TransactionStatus.PENDING) {
            throw new RuntimeException("Transaction cannot be confirmed - status: " + transaction.getStatus().name());
        }

        if (transaction.getExpiresAt() != null && LocalDateTime.now().isAfter(transaction.getExpiresAt())) {
            transaction.setStatus(Transaction.TransactionStatus.CANCELLED);
            transactionRepository.save(transaction);
            throw new RuntimeException("Transaction has expired. Please initiate a new transfer.");
        }

        //Lock both wallets and execute transfer atomically
        Wallet senderWallet = walletRepository.findByUserIdForUpdate(sender.getId())
                .orElseThrow(() -> new RuntimeException("Sender wallet not found"));

        Wallet recipientWallet = walletRepository.findByUserIdForUpdate(transaction.getRecipientId())
                .orElseThrow(() -> new RuntimeException("Recipient wallet not found"));

        // Re-check balance (could have changed since initiation)
        if (senderWallet.getBalance().compareTo(transaction.getAmount()) < 0) {
            transaction.setStatus(Transaction.TransactionStatus.FAILED);
            transactionRepository.save(transaction);
            throw new RuntimeException("Insufficient balance");
        }

        // Debit sender, credit recipient
        senderWallet.setBalance(senderWallet.getBalance().subtract(transaction.getAmount()));
        recipientWallet.setBalance(recipientWallet.getBalance().add(transaction.getAmount()));

        walletRepository.save(senderWallet);
        walletRepository.save(recipientWallet);

        // Mark transaction complete
        transaction.setStatus(Transaction.TransactionStatus.COMPLETED);
        transaction.setCompletedAt(LocalDateTime.now());
        transactionRepository.save(transaction);

        User recipient = userRepository.findById(transaction.getRecipientId())
                .orElseThrow(() -> new RuntimeException("Recipient not found"));

        return buildTransferResponse(transaction, sender, recipient);
    }

    // ==================== CANCEL TRANSFER ====================

    @Transactional
    public TransferResponse cancelTransfer(User sender, UUID transactionId) {
        Transaction transaction = transactionRepository.findById(transactionId)
                .orElseThrow(() -> new RuntimeException("Transaction not found"));

        if (!transaction.getSenderId().equals(sender.getId())) {
            throw new RuntimeException("Not authorized to cancel this transaction");
        }
        if (transaction.getStatus() != Transaction.TransactionStatus.PENDING) {
            throw new RuntimeException("Only pending transactions can be cancelled");
        }

        transaction.setStatus(Transaction.TransactionStatus.CANCELLED);
        transaction.setCancelledAt(LocalDateTime.now());
        transactionRepository.save(transaction);

        User recipient = userRepository.findById(transaction.getRecipientId())
                .orElseThrow(() -> new RuntimeException("Recipient not found"));

        return buildTransferResponse(transaction, sender, recipient);
    }

    // ==================== MONEY REQUESTS ====================

    @Transactional
    public TransferResponse requestMoney(User requester, MoneyRequestDto request) {
        User fromUser = userRepository
                .findByEmailOrPhone(request.getFromIdentifier(), request.getFromIdentifier())
                .orElseThrow(() -> new RuntimeException("User not found"));

        if(fromUser.getId().equals(requester.getId())) {
            throw new RuntimeException("Cannot request money from yourself");
        }

        Transaction transaction = Transaction.builder()
                .senderId(fromUser.getId())
                .recipientId(requester.getId())
                .amount(request.getAmount())
                .note(request.getNote())
                .type(Transaction.TransactionType.REQUEST)
                .status(Transaction.TransactionStatus.PENDING)
                .isRequest(true)
                .requestedAt(LocalDateTime.now())
                .build();

        transaction = transactionRepository.save(transaction);
        return buildTransferResponse(transaction, fromUser, requester);
    }

    @Transactional
    public TransferResponse acceptMoneyRequest(User payer, UUID transactionId, String passcode) {
        if (payer.getStatus() != User.AccountStatus.ACTIVE) {
            throw new RuntimeException("Your account is not active");
        }

        userService.verifyPasscode(payer, passcode);

        Transaction transaction = transactionRepository.findById(transactionId)
                .orElseThrow(() -> new RuntimeException("Transaction not found"));

        if (!transaction.getSenderId().equals(payer.getId())) {
            throw new RuntimeException("Not authorized — this request is not addressed to you");
        }
        if(transaction.getStatus() == Transaction.TransactionStatus.COMPLETED) {
            User requester = userRepository.findById(transaction.getRecipientId()).orElse(null);
            return buildTransferResponse(transaction, payer, requester);
        }

        if (transaction.getStatus() != Transaction.TransactionStatus.PENDING) {
            throw new RuntimeException("Request is no longer pending");
        }

        if (transaction.getAmount().compareTo(maxSingleAmount) > 0) {
            throw new RuntimeException("Amount exceeds your single transfer limit of GHS " + maxSingleAmount);
        }

        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        LocalDateTime endOfDay = startOfDay.plusDays(1);
        BigDecimal todayTotal = transactionRepository.getTotalSentToday(
                payer.getId(), startOfDay, endOfDay);
        if (todayTotal.add(transaction.getAmount()).compareTo(maxDailyAmount) > 0) {
            throw new RuntimeException("Accepting this request would exceed your daily transfer limit of GHS " + maxDailyAmount);
        }

        // Execute transfer
        Wallet payerWallet = walletRepository.findByUserIdForUpdate(payer.getId())
                .orElseThrow(() -> new RuntimeException("Wallet not found"));
        Wallet requesterWallet = walletRepository.findByUserIdForUpdate(transaction.getRecipientId())
                .orElseThrow(() -> new RuntimeException("Wallet not found"));

        if (payerWallet.getBalance().compareTo(transaction.getAmount()) < 0) {
            throw new RuntimeException("Insufficient balance");
        }

        payerWallet.setBalance(payerWallet.getBalance().subtract(transaction.getAmount()));
        requesterWallet.setBalance(requesterWallet.getBalance().add(transaction.getAmount()));

        walletRepository.save(payerWallet);
        walletRepository.save(requesterWallet);

        transaction.setStatus(Transaction.TransactionStatus.COMPLETED);
        transaction.setAcceptedAt(LocalDateTime.now());
        transaction.setCompletedAt(LocalDateTime.now());
        transactionRepository.save(transaction);

        User requester = userRepository.findById(transaction.getRecipientId())
                .orElseThrow(() -> new RuntimeException("User not found"));

        return buildTransferResponse(transaction, payer, requester);
    }

    @Transactional
    public TransferResponse declineMoneyRequest(User payer, UUID transactionId) {
        Transaction transaction = transactionRepository.findById(transactionId)
                .orElseThrow(() -> new RuntimeException("Transaction not found"));

        if (!transaction.getSenderId().equals(payer.getId())) {
            throw new RuntimeException("Not authorized");
        }
        if (transaction.getStatus() != Transaction.TransactionStatus.PENDING) {
            throw new RuntimeException("Request is no longer pending");
        }

        transaction.setStatus(Transaction.TransactionStatus.DECLINED);
        transaction.setDeclinedAt(LocalDateTime.now());
        transactionRepository.save(transaction);

        User requester = userRepository.findById(transaction.getRecipientId())
                .orElseThrow(() -> new RuntimeException("User not found"));

        return buildTransferResponse(transaction, payer, requester);
    }

    // ==================== TRANSACTION HISTORY ====================

    public Page<TransferResponse> getTransactionHistory(UUID userId, String type,
                                                         String status, int page, int size) {
        int cappedSize = Math.min(size, 100);
        PageRequest pageRequest = PageRequest.of(page, cappedSize);
        Page<Transaction> transactions;

        if (type != null && !type.isBlank()) {
            try {
                transactions = transactionRepository.findAllByUserIdAndType(
                        userId, Transaction.TransactionType.valueOf(type.toUpperCase()), pageRequest);
            } catch (IllegalArgumentException e ) {
                throw new RuntimeException("Invalid transaction type. Accepted values: TRANSFER, REQUEST");
            }
        } else if (status != null && !status.isBlank()) {
            try {
                transactions = transactionRepository.findAllByUserIdAndStatus(
                        userId, Transaction.TransactionStatus.valueOf(status.toUpperCase()), pageRequest);
            } catch (IllegalArgumentException e) {
                throw new RuntimeException("Invalid status. Accepted values: PENDING, COMPLETED, FAILED, CANCELLED, DECLINED");
            }
        } else {
            transactions = transactionRepository.findAllByUserId(userId, pageRequest);
        }

        return transactions.map(t -> {
            User sender = userRepository.findById(t.getSenderId()).orElse(null);
            User recipient = userRepository.findById(t.getRecipientId()).orElse(null);
            return buildTransferResponse(t, sender, recipient);
        });
    }

    public TransferResponse getTransaction(UUID transactionId, UUID userId) {
        Transaction t = transactionRepository.findById(transactionId)
                .orElseThrow(() -> new RuntimeException("Transaction not found"));

        if (!t.getSenderId().equals(userId) && !t.getRecipientId().equals(userId)) {
            throw new RuntimeException("Not authorized to view this transaction");
        }

        User sender = userRepository.findById(t.getSenderId()).orElse(null);
        User recipient = userRepository.findById(t.getRecipientId()).orElse(null);
        return buildTransferResponse(t, sender, recipient);
    }

    //  HELPER

    private TransferResponse buildTransferResponse(Transaction t, User sender, User recipient) {
        return TransferResponse.builder()
                .id(t.getId().toString())
                .senderId(t.getSenderId().toString())
                .senderName(sender != null ? sender.getFirstName() + " " + sender.getLastName() : "Unknown")
                .recipientId(t.getRecipientId().toString())
                .recipientName(recipient != null ? recipient.getFirstName() + " " + recipient.getLastName() : "Unknown")
                .amount(t.getAmount())
                .currency("GHS")
                .note(t.getNote())
                .type(t.getType().name())
                .status(t.getStatus().name())
                .initiatedAt(t.getInitiatedAt() != null ? t.getInitiatedAt().toString() : null)
                .completedAt(t.getCompletedAt() != null ? t.getCompletedAt().toString() : null)
                .build();
    }
}
