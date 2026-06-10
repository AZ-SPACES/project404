package com.aza.backend.util;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@Service
@Slf4j
public class SmsService {

    @Value("${arkesel.api-key}")
    private String apiKey;

    @Value("${arkesel.sender-id}")
    private String senderId;

    private static final String ARKESEL_URL = "https://sms.arkesel.com/api/v2/sms/send";

    private final RestTemplate restTemplate = new RestTemplate();

    /**
     * Send an SMS via Arkesel API
     */
    public boolean sendSms(String phoneNumber, String message) {
        String formattedNumber = formatPhoneNumber(phoneNumber);
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("api-key", apiKey);

            Map<String, Object> body = new HashMap<>();
            body.put("sender", senderId);
            body.put("message", message);
            body.put("recipients", List.of(formattedNumber));

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

            log.info("Sending SMS to {} via Arkesel...", formattedNumber);
            ResponseEntity<String> response = restTemplate.exchange(
                    ARKESEL_URL, HttpMethod.POST, request, String.class);

            log.info("Arkesel SMS response status: {}", response.getStatusCode());
            log.info("Arkesel SMS response body: {}", response.getBody());
            return response.getStatusCode().is2xxSuccessful();

        } catch (Exception e) {
            log.error("Failed to send SMS to {}: {}", formattedNumber, e.getMessage());
            return false;
        }
    }

    /**
     * Send OTP via SMS
     */
    public boolean sendOtp(String phoneNumber, String otp) {
        String message = "Your AZA verification code is: " + otp + ". Valid for 5 minutes. Do not share this code.";
        return sendSms(phoneNumber, message);
    }

    public boolean sendBirthdaySms(String phoneNumber, String name) {
        String message = "Happy Birthday, " + name + "! Wishing you a wonderful day from all of us at AZA.";
        return sendSms(phoneNumber, message);
    }

    public void sendTransferSentSms(String phoneNumber, String recipientName,
                                    BigDecimal amount, String txnRef, BigDecimal newBalance,
                                    String reference, String transactionId, BigDecimal fee, BigDecimal tax) {
        CompletableFuture.runAsync(() -> {
            String bal = newBalance != null ? fmt(newBalance) : "0.00";
            String noteSegment = (reference != null && !reference.isBlank()) ? " Note: " + reference + "." : "";
            String msg = "AZA: You sent GHS " + fmt(amount) + " to " + recipientName + "."
                    + noteSegment + " New bal: GHS " + bal + ". Txn ID: " + transactionId + ".";
            sendSms(phoneNumber, msg);
        });
    }

    public void sendTransferReceivedSms(String phoneNumber, String senderName,
                                        BigDecimal amount, String txnRef, BigDecimal newBalance,
                                        String reference, String transactionId, BigDecimal fee) {
        CompletableFuture.runAsync(() -> {
            String bal = newBalance != null ? fmt(newBalance) : "0.00";
            String noteSegment = (reference != null && !reference.isBlank()) ? " Note: " + reference + "." : "";
            String msg = "AZA: GHS " + fmt(amount) + " was sent to you by " + senderName + "."
                    + noteSegment + " New bal: GHS " + bal + ". Txn ID: " + transactionId + ".";
            sendSms(phoneNumber, msg);
        });
    }

    private static String fmt(BigDecimal v) {
        return String.format("%,.2f", v.setScale(2, RoundingMode.HALF_UP));
    }

    public void sendMoneyRequestedSms(String phoneNumber, String requesterName, BigDecimal amount) {
        CompletableFuture.runAsync(() -> {
            String msg = "AZA: " + requesterName + " is requesting GHS "
                    + amount.setScale(2, RoundingMode.HALF_UP)
                    + " from you. Open AZA to review.";
            sendSms(phoneNumber, msg);
        });
    }

    public void sendPaymentRequestPaidSms(String phoneNumber, String payerName, BigDecimal amount) {
        CompletableFuture.runAsync(() -> {
            String msg = "AZA: GHS " + amount.setScale(2, RoundingMode.HALF_UP)
                    + " received from " + payerName + " for your payment request.";
            sendSms(phoneNumber, msg);
        });
    }


    private String formatPhoneNumber(String phoneNumber) {
        if (phoneNumber == null) return "";
        // Remove all non-digits
        String digits = phoneNumber.replaceAll("\\D", "");
        
        // If it starts with 0, replace with 233
        if (digits.startsWith("0") && digits.length() == 10) {
            return "233" + digits.substring(1);
        }
        
        // If it starts with +, it was handled by \\D (removed)
        // If it already starts with 233 and is 12 digits, return as is
        if (digits.startsWith("233") && digits.length() == 12) {
            return digits;
        }

        return digits;
    }

    // ── GDPR Account Deletion ──────────────────────────────────────────────────

    public void sendDeletionScheduledSms(String phoneNumber, java.time.LocalDateTime deletionDate) {
        sendSms(phoneNumber,
                "AZA: Your account is scheduled for permanent deletion on " +
                deletionDate.toLocalDate() + ". Log in and go to Settings > Security & Privacy to cancel.");
    }

    public void sendDeletionCancelledSms(String phoneNumber) {
        sendSms(phoneNumber,
                "AZA: Your account deletion has been cancelled. Your account is active again.");
    }

    public void sendDeletionCompletedSms(String phoneNumber) {
        sendSms(phoneNumber,
                "AZA: Your account has been permanently deleted. Financial records are retained " +
                "as required by Bank of Ghana regulations. Thank you for using AZA.");
    }
}
