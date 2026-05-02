package com.aza.backend.service;

import com.aza.backend.entity.Transaction;
import com.aza.backend.entity.User;
import com.aza.backend.repository.TransactionRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.util.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class BillForwardingService {

    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    private final EmailService emailService;

    /**
     * Simulates receiving an email from a user's registered email address.
     * Identifies the user by the 'From' address.
     */
    @Transactional
    public void processIncomingBillByEmail(String fromEmail, String billSubject, BigDecimal amount, String merchantName) {
        log.info("Processing incoming bill from email: {} from merchant: {}", fromEmail, merchantName);

        Optional<User> userOpt = userRepository.findByEmail(fromEmail.toLowerCase());
        if (userOpt.isEmpty()) {
            log.warn("User with email {} not found. Ignoring bill.", fromEmail);
            return;
        }

        User user = userOpt.get();
        processBillForUser(user, billSubject, amount, merchantName);
    }

    /**
     * Simulates receiving an email to bills+{handle}@aza.app
     * Processes the bill and creates a DRAFT transaction.
     */
    @Transactional
    public void processIncomingBill(String handle, String billSubject, BigDecimal amount, String merchantName) {
        log.info("Processing incoming bill for handle: {} from merchant: {}", handle, merchantName);

        Optional<User> userOpt = userRepository.findByHandle(handle.toLowerCase());
        if (userOpt.isEmpty()) {
            log.warn("User with handle {} not found. Ignoring bill.", handle);
            return;
        }

        User user = userOpt.get();
        processBillForUser(user, billSubject, amount, merchantName);
    }

    private void processBillForUser(User user, String billSubject, BigDecimal amount, String merchantName) {
        if (!Boolean.TRUE.equals(user.getBillForwardingEnabled())) {
            log.warn("Bill forwarding is disabled for user {}. Ignoring bill.", user.getHandle());
            return;
        }

        Transaction draft = Transaction.builder()
                .senderId(user.getId())
                .recipientId(user.getId()) // Self-pointing for now as it's a draft 'to be paid'
                .amount(amount)
                .note("Bill from " + merchantName + ": " + billSubject)
                .status(Transaction.TransactionStatus.DRAFT)
                .type(Transaction.TransactionType.TRANSFER)
                .build();

        transactionRepository.save(draft);
        log.info("Created draft transaction {} for user {}", draft.getId(), user.getId());

        // Send notification email
        emailService.sendBillReceivedEmail(user.getEmail(), user.getFirstName(), merchantName, amount);
    }
}
