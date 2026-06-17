package com.aza.backend.service;

import com.aza.backend.dto.PaymentProofResponse;
import com.aza.backend.dto.PaymentVerifyResponse;
import com.aza.backend.entity.Transaction;
import com.aza.backend.entity.User;
import com.aza.backend.repository.TransactionRepository;
import com.aza.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;
import java.util.Optional;
import java.util.UUID;

/**
 * Issues and verifies tamper-evident "payment proof" QR codes. A payer can show
 * the recipient (e.g. a merchant or agent) a signed QR that proves a transfer
 * actually completed, and the recipient verifies it without trusting the screen.
 *
 * The signature is an HMAC-SHA256 over the transaction id, so a proof can't be
 * forged for an arbitrary transaction. Verification reads the existing ledger —
 * no new state is stored.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentProofService {

    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;

    @Value("${app.payment-proof.hmac-secret:change-me-in-production}")
    private String hmacSecret;

    @Value("${app.payment-proof.base-url:https://aza.systems}")
    private String baseUrl;

    private static final DateTimeFormatter TS_FMT =
            DateTimeFormatter.ofPattern("dd MMM yyyy, HH:mm");

    /** Generate a proof for a completed transaction the requester was party to. */
    public PaymentProofResponse generateProof(UUID transactionId, User requester) {
        Transaction txn = transactionRepository.findById(transactionId)
                .orElseThrow(() -> new IllegalArgumentException("Transaction not found"));

        boolean isParty = requester.getId().equals(txn.getSenderId())
                || requester.getId().equals(txn.getRecipientId());
        if (!isParty) {
            throw new SecurityException("You can only create a proof for your own payments.");
        }
        if (txn.getStatus() != Transaction.TransactionStatus.COMPLETED) {
            throw new IllegalArgumentException("Only completed payments can be proven.");
        }

        String ref = txn.getId().toString();
        String sig = sign(ref);
        String proofUrl = baseUrl + "/p?ref=" + ref + "&sig=" + sig;

        return PaymentProofResponse.builder()
                .transactionId(ref)
                .reference(ref)
                .amount(txn.getAmount())
                .currency("GHS")
                .proofUrl(proofUrl)
                .signature(sig)
                .build();
    }

    /** Verify a scanned proof. Returns {@code verified=false} for any tampering. */
    public PaymentVerifyResponse verify(String ref, String sig) {
        if (ref == null || sig == null || !constantTimeEquals(sign(ref), sig)) {
            return PaymentVerifyResponse.builder().verified(false).build();
        }

        Transaction txn;
        try {
            txn = transactionRepository.findById(UUID.fromString(ref)).orElse(null);
        } catch (IllegalArgumentException badUuid) {
            txn = null;
        }
        if (txn == null || txn.getStatus() != Transaction.TransactionStatus.COMPLETED) {
            return PaymentVerifyResponse.builder().verified(false).build();
        }

        return PaymentVerifyResponse.builder()
                .verified(true)
                .senderName(displayName(txn.getSenderId()))
                .recipientName(displayName(txn.getRecipientId()))
                .amount(txn.getAmount())
                .currency("GHS")
                .status(txn.getStatus().name())
                .completedAt(txn.getCompletedAt() != null ? txn.getCompletedAt().format(TS_FMT) : null)
                .reference(ref)
                .issuedBy("AZA Financial Technology Ltd")
                .build();
    }

    private String displayName(UUID userId) {
        Optional<User> u = userRepository.findById(userId);
        if (u.isEmpty()) return "Aza user";
        User user = u.get();
        String name = ((user.getFirstName() == null ? "" : user.getFirstName()) + " "
                + (user.getLastName() == null ? "" : user.getLastName())).trim();
        if (!name.isBlank()) return name;
        return user.getUsername() != null ? "@" + user.getUsername() : "Aza user";
    }

    private String sign(String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(hmacSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] raw = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(raw.length * 2);
            for (byte b : raw) hex.append(String.format("%02x", b));
            return hex.toString();
        } catch (Exception e) {
            throw new IllegalStateException("Failed to sign payment proof", e);
        }
    }

    private static boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null || a.length() != b.length()) return false;
        int result = 0;
        for (int i = 0; i < a.length(); i++) result |= a.charAt(i) ^ b.charAt(i);
        return result == 0;
    }
}
