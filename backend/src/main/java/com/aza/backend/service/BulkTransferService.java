package com.aza.backend.service;

import com.aza.backend.dto.merchant.*;
import com.aza.backend.entity.*;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.*;
import com.aza.backend.util.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class BulkTransferService {

    private final BulkTransferRepository bulkTransferRepository;
    private final BulkTransferItemRepository bulkTransferItemRepository;
    private final MerchantRepository merchantRepository;
    private final UserRepository userRepository;
    private final WalletRepository walletRepository;
    private final TransactionRepository transactionRepository;
    private final EmailService emailService;

    @Transactional
    public BulkTransferResponse createBulkTransfer(UUID merchantId, CreateBulkTransferRequest request) {
        if (request.getItems() == null || request.getItems().isEmpty()) {
            throw new AppException("EMPTY_ITEMS", "At least one recipient is required", HttpStatus.BAD_REQUEST);
        }
        if (request.getItems().size() > 100) {
            throw new AppException("TOO_MANY_ITEMS", "Maximum 100 recipients per bulk transfer", HttpStatus.BAD_REQUEST);
        }

        // Validate all item amounts
        for (BulkTransferItemRequest item : request.getItems()) {
            if (item.getAmount() == null || item.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
                throw new AppException("INVALID_AMOUNT",
                        "Each recipient amount must be greater than 0", HttpStatus.BAD_REQUEST);
            }
        }

        BigDecimal totalAmount = request.getItems().stream()
                .map(BulkTransferItemRequest::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Pessimistic lock on merchant
        Merchant merchant = merchantRepository.findByIdForUpdate(merchantId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Merchant not found", HttpStatus.NOT_FOUND));

        if (merchant.getStatus() != Merchant.MerchantStatus.ACTIVE) {
            throw new AppException("NOT_ACTIVE",
                    "Your merchant account must be active to perform this action", HttpStatus.FORBIDDEN);
        }

        if (merchant.getBalance().compareTo(totalAmount) < 0) {
            throw new AppException("INSUFFICIENT_FUNDS",
                    "Merchant balance is insufficient for this bulk transfer. Available: "
                            + merchant.getCurrency() + " " + merchant.getBalance()
                            + ", Required: " + merchant.getCurrency() + " " + totalAmount,
                    HttpStatus.BAD_REQUEST);
        }

        // Debit merchant balance upfront
        merchant.setBalance(merchant.getBalance().subtract(totalAmount));
        merchantRepository.save(merchant);

        // Save the bulk transfer record
        BulkTransfer bulkTransfer = BulkTransfer.builder()
                .merchantId(merchantId)
                .note(request.getNote())
                .totalAmount(totalAmount)
                .recipientCount(request.getItems().size())
                .status(BulkTransfer.BulkTransferStatus.PROCESSING)
                .build();
        bulkTransferRepository.save(bulkTransfer);

        int successCount = 0;
        int failureCount = 0;
        BigDecimal refundAmount = BigDecimal.ZERO;
        List<BulkTransferItem> items = new ArrayList<>();

        for (BulkTransferItemRequest itemReq : request.getItems()) {
            BulkTransferItem item = BulkTransferItem.builder()
                    .bulkTransferId(bulkTransfer.getId())
                    .recipientIdentifier(itemReq.getRecipientIdentifier())
                    .amount(itemReq.getAmount())
                    .note(itemReq.getNote())
                    .status(BulkTransferItem.BulkTransferItemStatus.PENDING)
                    .build();

            // Look up user by email or username
            String identifier = itemReq.getRecipientIdentifier().trim();
            User recipient = userRepository.findByEmailIgnoreCaseOrUsername(identifier, identifier).orElse(null);

            if (recipient == null || recipient.getStatus() != User.AccountStatus.ACTIVE) {
                item.setStatus(BulkTransferItem.BulkTransferItemStatus.FAILED);
                item.setFailureReason(recipient == null ? "Recipient not found" : "Recipient account is not active");
                item.setProcessedAt(LocalDateTime.now());
                failureCount++;
                refundAmount = refundAmount.add(itemReq.getAmount());
            } else {
                // Credit recipient wallet
                Wallet recipientWallet = walletRepository.findByUserId(recipient.getId()).orElse(null);
                if (recipientWallet == null) {
                    item.setStatus(BulkTransferItem.BulkTransferItemStatus.FAILED);
                    item.setFailureReason("Recipient wallet not found");
                    item.setProcessedAt(LocalDateTime.now());
                    failureCount++;
                    refundAmount = refundAmount.add(itemReq.getAmount());
                } else {
                    recipientWallet.setBalance(recipientWallet.getBalance().add(itemReq.getAmount()));
                    walletRepository.save(recipientWallet);
                    recipient.setBalance(recipientWallet.getBalance());
                    userRepository.save(recipient);

                    // Create a transaction record
                    String txNote = itemReq.getNote() != null && !itemReq.getNote().isBlank()
                            ? itemReq.getNote()
                            : (request.getNote() != null && !request.getNote().isBlank()
                            ? request.getNote()
                            : "Bulk transfer from merchant");

                    Transaction tx = Transaction.builder()
                            .senderId(merchant.getUserId())
                            .recipientId(recipient.getId())
                            .amount(itemReq.getAmount())
                            .note(txNote)
                            .type(Transaction.TransactionType.TRANSFER)
                            .status(Transaction.TransactionStatus.COMPLETED)
                            .idempotencyKey("bulk:" + bulkTransfer.getId() + ":" + identifier)
                            .completedAt(LocalDateTime.now())
                            .build();
                    transactionRepository.save(tx);

                    item.setRecipientUserId(recipient.getId());
                    item.setStatus(BulkTransferItem.BulkTransferItemStatus.COMPLETED);
                    item.setProcessedAt(LocalDateTime.now());
                    successCount++;
                }
            }
            items.add(item);
        }

        bulkTransferItemRepository.saveAll(items);

        // Refund failed amounts back to merchant
        if (refundAmount.compareTo(BigDecimal.ZERO) > 0) {
            merchant = merchantRepository.findById(merchantId)
                    .orElseThrow(() -> new AppException("NOT_FOUND", "Merchant not found", HttpStatus.NOT_FOUND));
            merchant.setBalance(merchant.getBalance().add(refundAmount));
            merchantRepository.save(merchant);
        }

        // Finalize bulk transfer status
        BulkTransfer.BulkTransferStatus finalStatus;
        if (failureCount == 0) {
            finalStatus = BulkTransfer.BulkTransferStatus.COMPLETED;
        } else if (successCount == 0) {
            finalStatus = BulkTransfer.BulkTransferStatus.FAILED;
        } else {
            finalStatus = BulkTransfer.BulkTransferStatus.PARTIALLY_COMPLETED;
        }

        bulkTransfer.setSuccessCount(successCount);
        bulkTransfer.setFailureCount(failureCount);
        bulkTransfer.setStatus(finalStatus);
        bulkTransfer.setProcessedAt(LocalDateTime.now());
        bulkTransferRepository.save(bulkTransfer);

        log.info("Bulk transfer completed: id={}, merchantId={}, total={}, success={}, failed={}",
                bulkTransfer.getId(), merchantId, totalAmount, successCount, failureCount);

        final UUID ownerUserId = merchant.getUserId();
        final String businessName = merchant.getBusinessName();
        final String statusName = finalStatus.name();
        final int finalSuccessCount = successCount;
        final int finalFailureCount = failureCount;
        final BigDecimal disbursed = totalAmount.subtract(refundAmount);
        userRepository.findById(ownerUserId).ifPresent(owner ->
                emailService.sendBulkTransferSummaryEmail(
                        owner.getEmail(), owner.getFirstName(),
                        businessName, disbursed, finalSuccessCount, finalFailureCount, statusName));

        return toResponse(bulkTransfer);
    }

    public Page<BulkTransferResponse> listBulkTransfers(UUID merchantId, int page, int size) {
        return bulkTransferRepository.findAllByMerchantIdOrderByCreatedAtDesc(
                        merchantId, PageRequest.of(page, Math.min(size, 50)))
                .map(this::toResponse);
    }

    public BulkTransferDetailResponse getBulkTransfer(UUID merchantId, UUID id) {
        BulkTransfer transfer = bulkTransferRepository.findByIdAndMerchantId(id, merchantId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Bulk transfer not found", HttpStatus.NOT_FOUND));
        List<BulkTransferItem> items = bulkTransferItemRepository.findAllByBulkTransferId(id);
        return toDetailResponse(transfer, items);
    }

    private BulkTransferResponse toResponse(BulkTransfer bt) {
        return BulkTransferResponse.builder()
                .id(bt.getId())
                .merchantId(bt.getMerchantId())
                .note(bt.getNote())
                .totalAmount(bt.getTotalAmount())
                .recipientCount(bt.getRecipientCount())
                .successCount(bt.getSuccessCount())
                .failureCount(bt.getFailureCount())
                .status(bt.getStatus().name())
                .createdAt(bt.getCreatedAt())
                .processedAt(bt.getProcessedAt())
                .build();
    }

    private BulkTransferDetailResponse toDetailResponse(BulkTransfer bt, List<BulkTransferItem> items) {
        return BulkTransferDetailResponse.builder()
                .id(bt.getId())
                .merchantId(bt.getMerchantId())
                .note(bt.getNote())
                .totalAmount(bt.getTotalAmount())
                .recipientCount(bt.getRecipientCount())
                .successCount(bt.getSuccessCount())
                .failureCount(bt.getFailureCount())
                .status(bt.getStatus().name())
                .createdAt(bt.getCreatedAt())
                .processedAt(bt.getProcessedAt())
                .items(items.stream().map(this::toItemResponse).collect(Collectors.toList()))
                .build();
    }

    private BulkTransferItemResponse toItemResponse(BulkTransferItem item) {
        return BulkTransferItemResponse.builder()
                .id(item.getId())
                .recipientIdentifier(item.getRecipientIdentifier())
                .amount(item.getAmount())
                .note(item.getNote())
                .status(item.getStatus().name())
                .failureReason(item.getFailureReason())
                .processedAt(item.getProcessedAt())
                .build();
    }
}
