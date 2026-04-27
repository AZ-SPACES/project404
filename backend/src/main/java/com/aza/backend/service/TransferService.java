package com.aza.backend.service;

import com.aza.backend.dto.transfer.*;
import com.aza.backend.entity.Transaction;
import com.aza.backend.entity.User;
import com.aza.backend.entity.Wallet;
import com.aza.backend.repository.TransactionRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.repository.WalletRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TransferService {

    private final TransactionRepository transactionRepository;
    private final WalletRepository walletRepository;
    private final UserRepository userRepository;
    private final AuthService authService;

    // ==================== WALLET ====================

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

    // ==================== INITIATE TRANSFER ====================

    @Transactional
    public TransferResponse initiateTransfer(User sender, TransferRequest request) {
        // 1. Verify KYC
        if (sender.getKycStatus() != User.KycStatus.VERIFIED) {
            // For testing, we'll skip this check.
            // Uncomment below to enforce KYC:
            // throw new RuntimeException("KYC verification required before transfers");
        }

        // 2. Find recipient
        User recipient = userRepository
                .findByEmailOrPhone(request.getRecipientIdentifier(), request.getRecipientIdentifier())
                .orElseThrow(() -> new RuntimeException("Recipient not found"));

        if (recipient.getId().equals(sender.getId())) {
            throw new RuntimeException("Cannot transfer to yourself");
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
                .build();

        transaction = transactionRepository.save(transaction);

        return buildTransferResponse(transaction, sender, recipient);
    }

    // ==================== CONFIRM TRANSFER (with PIN) ====================

    @Transactional
    public TransferResponse confirmTransfer(User sender, UUID transactionId, String passcode) {
        // 1. Verify passcode
        authService.verifyPasscode(sender, passcode);

        // 2. Find the pending transaction
        Transaction transaction = transactionRepository.findById(transactionId)
                .orElseThrow(() -> new RuntimeException("Transaction not found"));

        if (!transaction.getSenderId().equals(sender.getId())) {
            throw new RuntimeException("Not authorized to confirm this transaction");
        }
        if (transaction.getStatus() != Transaction.TransactionStatus.PENDING) {
            throw new RuntimeException("Transaction is not pending");
        }

        // 3. Lock both wallets and execute transfer atomically
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

        // 4. Debit sender, credit recipient
        senderWallet.setBalance(senderWallet.getBalance().subtract(transaction.getAmount()));
        recipientWallet.setBalance(recipientWallet.getBalance().add(transaction.getAmount()));

        walletRepository.save(senderWallet);
        walletRepository.save(recipientWallet);

        // 5. Mark transaction complete
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

        Transaction transaction = Transaction.builder()
                .senderId(fromUser.getId())          // the person who will pay
                .recipientId(requester.getId())       // the person requesting money
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
        authService.verifyPasscode(payer, passcode);

        Transaction transaction = transactionRepository.findById(transactionId)
                .orElseThrow(() -> new RuntimeException("Transaction not found"));

        if (!transaction.getSenderId().equals(payer.getId())) {
            throw new RuntimeException("Not authorized — this request is not addressed to you");
        }
        if (transaction.getStatus() != Transaction.TransactionStatus.PENDING) {
            throw new RuntimeException("Request is no longer pending");
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
        PageRequest pageRequest = PageRequest.of(page, size);
        Page<Transaction> transactions;

        if (type != null && !type.isBlank()) {
            transactions = transactionRepository.findAllByUserIdAndType(
                    userId, Transaction.TransactionType.valueOf(type.toUpperCase()), pageRequest);
        } else if (status != null && !status.isBlank()) {
            transactions = transactionRepository.findAllByUserIdAndStatus(
                    userId, Transaction.TransactionStatus.valueOf(status.toUpperCase()), pageRequest);
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

    // ==================== HELPER ====================

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
