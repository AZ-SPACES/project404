package com.aza.backend.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Base64;
import java.util.concurrent.CompletableFuture;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final TemplateEngine templateEngine;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(java.time.Duration.ofSeconds(10))
            .build();

    @Value("${brevo.api-key}")
    private String brevoApiKey;

    @Value("${brevo.sender-email:noreply@aza.systems}")
    private String senderEmail;

    @Value("${app.api-base-url:https://api.aza.systems}")
    private String apiBaseUrl;

    private String inlineImages(String html) {
        String result = html.replace("src=\"cid:paperplane\"",   "src=\"" + apiBaseUrl + "/images/aza.png\"");
        result = result.replace("src=\"cid:aza_merchant\"", "src=\"" + apiBaseUrl + "/images/Aza_Merchant.png\"");
        result = result.replace("src=\"cid:aza_admin\"",    "src=\"" + apiBaseUrl + "/images/Aza-admin.png\"");
        result = result.replace("src=\"cid:aza_pay\"",      "src=\"" + apiBaseUrl + "/images/Aza-Pay.png\"");
        result = result.replace("src=\"cid:aza_default\"",  "src=\"" + apiBaseUrl + "/images/aza.png\"");
        return result;
    }

    public String getSupportEmail() {
        return senderEmail;
    }

    public boolean sendEmail(String to, String subject, String htmlBody) {
        return sendViaBrevo("AZA", senderEmail, to, subject, htmlBody, null, null);
    }

    public boolean sendOtp(String email, String otp) {
        Context ctx = new Context();
        ctx.setVariable("otp", otp);
        String html = inlineImages(templateEngine.process("email/otp-template", ctx));
        return sendViaBrevo("AZA", senderEmail, email, "AZA - Your Verification Code", html, null, null);
    }

    public void sendSignupNotification(String email, String name) {
        CompletableFuture.runAsync(() -> {
            Context ctx = new Context();
            ctx.setVariable("name", name);
            String html = inlineImages(templateEngine.process("email/signup-notification", ctx));
            sendViaBrevo("AZA", senderEmail, email, "Welcome to AZA!", html, null, null);
        });
    }

    public void sendWaitlistConfirmation(String email) {
        CompletableFuture.runAsync(() -> {
            Context ctx = new Context();
            String html = inlineImages(templateEngine.process("email/waitlist-confirmation", ctx));
            sendViaBrevo("AZA", senderEmail, email, "You're on the Aza waitlist!", html, null, null);
        });
    }

    public void sendBirthdayEmail(String email, String name) {
        CompletableFuture.runAsync(() -> {
            Context ctx = new Context();
            ctx.setVariable("name", name);
            String html = inlineImages(templateEngine.process("email/birthday-notification", ctx));
            sendViaBrevo("AZA", senderEmail, email, "Happy Birthday from AZA! 🎂", html, null, null);
        });
    }


    public void sendLoginNotification(String email, String name, String deviceName,
                                      String deviceOs, String ipAddress) {
        CompletableFuture.runAsync(() -> {
            Context ctx = new Context();
            ctx.setVariable("name", name);
            ctx.setVariable("deviceName", deviceName);
            ctx.setVariable("deviceOs", deviceOs);
            ctx.setVariable("ipAddress", ipAddress);
            LocationInfo loc = fetchLocationDetails(ipAddress);
            ctx.setVariable("location", loc.getDescription());
            ctx.setVariable("mapUrl", loc.getMapUrl());
            ctx.setVariable("loginTime", java.time.LocalDateTime.now()
                    .format(java.time.format.DateTimeFormatter.ofPattern("MMM dd, yyyy HH:mm")));
            String html = inlineImages(templateEngine.process("email/login-notification", ctx));
            sendViaBrevo("AZA Security", senderEmail, email,
                    "Security Alert: New Login to your AZA Account", html, null, null);
        });
    }

    public void sendLimitIncreaseEmail(String email, String firstName,
                                       boolean dailyIncreased, java.math.BigDecimal newDaily,
                                       boolean singleIncreased, java.math.BigDecimal newSingle) {
        CompletableFuture.runAsync(() -> {
            Context ctx = new Context();
            ctx.setVariable("name", firstName);
            ctx.setVariable("dailyIncreased", dailyIncreased);
            ctx.setVariable("newDaily", newDaily);
            ctx.setVariable("singleIncreased", singleIncreased);
            ctx.setVariable("newSingle", newSingle);
            String html = inlineImages(templateEngine.process("email/limit-increase", ctx));
            sendViaBrevo("AZA", senderEmail, email, "Your AZA transaction limits have been increased", html, null, null);
        });
    }

    public void sendKycStatusEmail(String email, String name, boolean approved, String reason) {
        CompletableFuture.runAsync(() -> {
            String subject = approved ? "AZA - Verification Successful" : "AZA - Verification Update Required";
            Context ctx = new Context();
            ctx.setVariable("name", name);
            ctx.setVariable("approved", approved);
            ctx.setVariable("reason", reason);
            String html = inlineImages(templateEngine.process("email/kyc-status", ctx));
            sendViaBrevo("AZA Support", senderEmail, email, subject, html, null, null);
        });
    }

    public void sendPasswordChangedNotification(String email, String name,
                                                String ipAddress, String secureToken) {
        CompletableFuture.runAsync(() -> {
            Context ctx = new Context();
            ctx.setVariable("name", name);
            ctx.setVariable("ipAddress", ipAddress);
            ctx.setVariable("secureLink", "https://aza.systems/secure?token=" + secureToken);
            ctx.setVariable("changeTime", java.time.LocalDateTime.now()
                    .format(java.time.format.DateTimeFormatter.ofPattern("MMM dd, yyyy HH:mm")));
            String html = inlineImages(templateEngine.process("email/password-changed", ctx));
            sendViaBrevo("AZA Security", senderEmail, email,
                    "Security Alert: Your AZA Password was Changed", html, null, null);
        });
    }

    public void sendBillReceivedEmail(String email, String name,
                                      String merchantName, BigDecimal amount) {
        CompletableFuture.runAsync(() -> {
            Context ctx = new Context();
            ctx.setVariable("name", name);
            ctx.setVariable("merchantName", merchantName);
            ctx.setVariable("amount", amount);
            ctx.setVariable("date", java.time.LocalDateTime.now()
                    .format(java.time.format.DateTimeFormatter.ofPattern("MMM dd, yyyy")));
            String html = inlineImages(templateEngine.process("email/bill-received", ctx));
            sendViaBrevo("AZA Bills", senderEmail, email,
                    "AZA - New Bill Received from " + merchantName, html, null, null);
        });
    }

    public void sendKycSubmittedEmail(String email, String name) {
        CompletableFuture.runAsync(() -> {
            Context ctx = new Context();
            ctx.setVariable("name", name);
            ctx.setVariable("submittedAt", java.time.LocalDateTime.now()
                    .format(java.time.format.DateTimeFormatter.ofPattern("MMM dd, yyyy HH:mm")));
            String html = inlineImages(templateEngine.process("email/kyc-submitted", ctx));
            sendViaBrevo("AZA Support", senderEmail, email,
                    "AZA - We've Received Your Verification Documents", html, null, null);
        });
    }

    public void sendDisputeOpenedMerchantEmail(String email, String name, String businessName,
                                                BigDecimal amount, String referenceId, String category) {
        CompletableFuture.runAsync(() -> {
            Context ctx = new Context();
            ctx.setVariable("name", name);
            ctx.setVariable("businessName", businessName);
            ctx.setVariable("amount", amount);
            ctx.setVariable("referenceId", referenceId);
            ctx.setVariable("category", category);
            ctx.setVariable("openedAt", java.time.LocalDateTime.now()
                    .format(java.time.format.DateTimeFormatter.ofPattern("MMM dd, yyyy HH:mm")));
            String html = inlineImages(templateEngine.process("email/dispute-opened-merchant", ctx));
            sendViaBrevo("AZA Support", senderEmail, email,
                    "Dispute Opened - " + referenceId, html, null, null);
        });
    }

    public void sendDisputeResolvedEmail(String email, String name, boolean approved,
                                          BigDecimal amount, String referenceId) {
        CompletableFuture.runAsync(() -> {
            String subject = approved
                    ? "Dispute Approved - " + referenceId
                    : "Dispute Closed - " + referenceId;
            Context ctx = new Context();
            ctx.setVariable("name", name);
            ctx.setVariable("approved", approved);
            ctx.setVariable("amount", amount);
            ctx.setVariable("referenceId", referenceId);
            ctx.setVariable("resolvedAt", java.time.LocalDateTime.now()
                    .format(java.time.format.DateTimeFormatter.ofPattern("MMM dd, yyyy HH:mm")));
            String html = inlineImages(templateEngine.process("email/dispute-resolved", ctx));
            sendViaBrevo("AZA Support", senderEmail, email, subject, html, null, null);
        });
    }

    public void sendRecoveryCodesLowEmail(String email, String name, long remaining) {
        CompletableFuture.runAsync(() -> {
            Context ctx = new Context();
            ctx.setVariable("name", name);
            ctx.setVariable("remaining", remaining);
            String html = inlineImages(templateEngine.process("email/recovery-codes-low", ctx));
            sendViaBrevo("AZA Security", senderEmail, email,
                    "Action Required: Recovery Codes Running Low", html, null, null);
        });
    }

    public void sendApiKeyRevokedEmail(String email, String name, String businessName,
                                        String label, String keyPrefix) {
        CompletableFuture.runAsync(() -> {
            Context ctx = new Context();
            ctx.setVariable("name", name);
            ctx.setVariable("businessName", businessName);
            ctx.setVariable("label", label);
            ctx.setVariable("keyPrefix", keyPrefix);
            ctx.setVariable("revokedAt", java.time.LocalDateTime.now()
                    .format(java.time.format.DateTimeFormatter.ofPattern("MMM dd, yyyy HH:mm")));
            String html = inlineImages(templateEngine.process("email/api-key-revoked", ctx));
            sendViaBrevo("AZA Business", senderEmail, email,
                    "API Key Revoked - " + businessName, html, null, null);
        });
    }

    public void sendBulkTransferSummaryEmail(String email, String name, String businessName,
                                              BigDecimal totalAmount, int successCount,
                                              int failureCount, String status) {
        CompletableFuture.runAsync(() -> {
            Context ctx = new Context();
            ctx.setVariable("name", name);
            ctx.setVariable("businessName", businessName);
            ctx.setVariable("totalAmount", totalAmount);
            ctx.setVariable("successCount", successCount);
            ctx.setVariable("failureCount", failureCount);
            ctx.setVariable("status", status);
            ctx.setVariable("processedAt", java.time.LocalDateTime.now()
                    .format(java.time.format.DateTimeFormatter.ofPattern("MMM dd, yyyy HH:mm")));
            String html = inlineImages(templateEngine.process("email/bulk-transfer-summary", ctx));
            sendViaBrevo("AZA Business", senderEmail, email,
                    "Bulk Transfer " + status + " - " + businessName, html, null, null);
        });
    }

    public void sendMerchantWeeklySummaryEmail(String email, String name, String businessName,
                                                BigDecimal revenue, long txnCount,
                                                BigDecimal balance, String weekRange) {
        CompletableFuture.runAsync(() -> {
            Context ctx = new Context();
            ctx.setVariable("name", name);
            ctx.setVariable("businessName", businessName);
            ctx.setVariable("revenue", revenue);
            ctx.setVariable("txnCount", txnCount);
            ctx.setVariable("balance", balance);
            ctx.setVariable("weekRange", weekRange);
            String html = inlineImages(templateEngine.process("email/merchant-weekly-summary", ctx));
            sendViaBrevo("AZA Business", senderEmail, email,
                    "Your Weekly Summary - " + businessName, html, null, null);
        });
    }

    public void sendWaitlistInvitationEmail(String email, String inviteUrl) {
        CompletableFuture.runAsync(() -> {
            Context ctx = new Context();
            ctx.setVariable("inviteUrl", inviteUrl);
            String html = inlineImages(templateEngine.process("email/waitlist-invitation", ctx));
            sendViaBrevo("AZA", senderEmail, email,
                    "You're Invited - Create Your AZA Account", html, null, null);
        });
    }

    public void sendKybStatusEmail(String email, String ownerName, String businessName,
                                    boolean approved, String moreInfoOrReason) {
        CompletableFuture.runAsync(() -> {
            String subject = approved
                    ? "Business Verified - " + businessName
                    : "Business Verification Update - " + businessName;
            Context ctx = new Context();
            ctx.setVariable("ownerName", ownerName);
            ctx.setVariable("businessName", businessName);
            ctx.setVariable("approved", approved);
            ctx.setVariable("moreInfoOrReason", moreInfoOrReason);
            String html = inlineImages(templateEngine.process("email/kyb-status", ctx));
            sendViaBrevo("AZA Business", senderEmail, email, subject, html, null, null);
        });
    }

    public void sendApiKeyCreatedEmail(String email, String name, String businessName,
                                        String label, String keyPrefix, String environment) {
        CompletableFuture.runAsync(() -> {
            Context ctx = new Context();
            ctx.setVariable("name", name);
            ctx.setVariable("businessName", businessName);
            ctx.setVariable("label", label);
            ctx.setVariable("keyPrefix", keyPrefix);
            ctx.setVariable("environment", environment);
            ctx.setVariable("createdAt", java.time.LocalDateTime.now()
                    .format(java.time.format.DateTimeFormatter.ofPattern("MMM dd, yyyy HH:mm")));
            String html = inlineImages(templateEngine.process("email/api-key-created", ctx));
            sendViaBrevo("AZA Business", senderEmail, email,
                    "New API Key Created - " + businessName, html, null, null);
        });
    }

    public void sendFailedLoginAlert(String email, String name, String ipAddress) {
        CompletableFuture.runAsync(() -> {
            Context ctx = new Context();
            ctx.setVariable("name", name);
            ctx.setVariable("ipAddress", ipAddress);
            LocationInfo loc = fetchLocationDetails(ipAddress);
            ctx.setVariable("location", loc.getDescription());
            ctx.setVariable("attemptTime", java.time.LocalDateTime.now()
                    .format(java.time.format.DateTimeFormatter.ofPattern("MMM dd, yyyy HH:mm")));
            String html = inlineImages(templateEngine.process("email/failed-login", ctx));
            sendViaBrevo("AZA Security", senderEmail, email,
                    "Security Alert: Failed Login Attempt on your AZA Account", html, null, null);
        });
    }

    public void sendTwoFactorChangedEmail(String email, String name, boolean enabled, String method) {
        CompletableFuture.runAsync(() -> {
            String subject = enabled
                    ? "Two-Factor Authentication Enabled - AZA"
                    : "Two-Factor Authentication Disabled - AZA";
            Context ctx = new Context();
            ctx.setVariable("name", name);
            ctx.setVariable("enabled", enabled);
            ctx.setVariable("method", method);
            ctx.setVariable("changedAt", java.time.LocalDateTime.now()
                    .format(java.time.format.DateTimeFormatter.ofPattern("MMM dd, yyyy HH:mm")));
            String html = inlineImages(templateEngine.process("email/two-factor-changed", ctx));
            sendViaBrevo("AZA Security", senderEmail, email, subject, html, null, null);
        });
    }

    public void sendAccountSecuredEmail(String email, String name) {
        CompletableFuture.runAsync(() -> {
            Context ctx = new Context();
            ctx.setVariable("name", name);
            ctx.setVariable("securedAt", java.time.LocalDateTime.now()
                    .format(java.time.format.DateTimeFormatter.ofPattern("MMM dd, yyyy HH:mm")));
            String html = inlineImages(templateEngine.process("email/account-secured", ctx));
            sendViaBrevo("AZA Security", senderEmail, email,
                    "Security Alert: Your AZA Account Has Been Secured", html, null, null);
        });
    }

    public void sendMerchantPaymentReceivedEmail(String email, String name, String businessName,
                                                  BigDecimal amount, String customerName, String txnRef) {
        CompletableFuture.runAsync(() -> {
            Context ctx = new Context();
            ctx.setVariable("name", name);
            ctx.setVariable("businessName", businessName);
            ctx.setVariable("amount", amount);
            ctx.setVariable("customerName", customerName);
            ctx.setVariable("txnRef", txnRef);
            ctx.setVariable("receivedAt", java.time.LocalDateTime.now()
                    .format(java.time.format.DateTimeFormatter.ofPattern("MMM dd, yyyy HH:mm")));
            String html = inlineImages(templateEngine.process("email/merchant-payment-received", ctx));
            sendViaBrevo("AZA Business", senderEmail, email,
                    "Payment Received - GHS " + amount, html, null, null);
        });
    }

    public void sendMerchantLowBalanceAlert(String email, String name, String businessName,
                                             BigDecimal balance, BigDecimal threshold) {
        CompletableFuture.runAsync(() -> {
            Context ctx = new Context();
            ctx.setVariable("name", name);
            ctx.setVariable("businessName", businessName);
            ctx.setVariable("balance", balance);
            ctx.setVariable("threshold", threshold);
            String html = inlineImages(templateEngine.process("email/merchant-low-balance", ctx));
            sendViaBrevo("AZA Business", senderEmail, email,
                    "Low Balance Alert - " + businessName, html, null, null);
        });
    }

    public void sendTransferSentEmail(String email, String name, String recipientName,
                                       BigDecimal amount, String txnRef) {
        CompletableFuture.runAsync(() -> {
            Context ctx = new Context();
            ctx.setVariable("name", name);
            ctx.setVariable("recipientName", recipientName);
            ctx.setVariable("amount", amount);
            ctx.setVariable("txnRef", txnRef);
            ctx.setVariable("completedAt", java.time.LocalDateTime.now()
                    .format(java.time.format.DateTimeFormatter.ofPattern("MMM dd, yyyy HH:mm")));
            String html = inlineImages(templateEngine.process("email/transfer-sent", ctx));
            sendViaBrevo("AZA", senderEmail, email, "Transfer Successful - GHS " + amount, html, null, null);
        });
    }

    public void sendPayoutCompletedEmail(String email, String name, String businessName,
                                          BigDecimal amount, String payoutRef) {
        CompletableFuture.runAsync(() -> {
            Context ctx = new Context();
            ctx.setVariable("name", name);
            ctx.setVariable("businessName", businessName);
            ctx.setVariable("amount", amount);
            ctx.setVariable("payoutRef", payoutRef);
            ctx.setVariable("completedAt", java.time.LocalDateTime.now()
                    .format(java.time.format.DateTimeFormatter.ofPattern("MMM dd, yyyy HH:mm")));
            String html = inlineImages(templateEngine.process("email/payout-completed", ctx));
            sendViaBrevo("AZA Business", senderEmail, email,
                    "Payout Completed - " + businessName, html, null, null);
        });
    }

    public void sendStatement(String email, String name, byte[] pdfContent, String period) {
        CompletableFuture.runAsync(() -> {
            String html = "<h3>Hello " + name + ",</h3>"
                    + "<p>Please find attached your account statement for the period <b>" + period + "</b>.</p>"
                    + "<p>If you have any questions, please contact our support team.</p>"
                    + "<br><p>Best regards,<br>The AZA Team</p>";
            String attachment = Base64.getEncoder().encodeToString(pdfContent);
            String filename = "aza_statement_" + period.replace(" ", "_") + ".pdf";
            sendViaBrevo("AZA Reports", senderEmail, email,
                    "Your AZA Account Statement - " + period, html, attachment, filename);
        });
    }

    private boolean sendViaBrevo(String senderName, String fromEmail, String toEmail,
                                  String subject, String htmlContent,
                                  String attachmentBase64, String attachmentName) {
        try {
            ObjectNode body = objectMapper.createObjectNode();
            ObjectNode sender = objectMapper.createObjectNode();
            sender.put("name", senderName);
            sender.put("email", fromEmail);
            body.set("sender", sender);

            ArrayNode toArray = objectMapper.createArrayNode();
            ObjectNode toObj = objectMapper.createObjectNode();
            toObj.put("email", toEmail);
            toArray.add(toObj);
            body.set("to", toArray);

            body.put("subject", subject);
            body.put("htmlContent", htmlContent);

            if (attachmentBase64 != null && attachmentName != null) {
                ArrayNode attachments = objectMapper.createArrayNode();
                ObjectNode att = objectMapper.createObjectNode();
                att.put("content", attachmentBase64);
                att.put("name", attachmentName);
                attachments.add(att);
                body.set("attachment", attachments);
            }

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.brevo.com/v3/smtp/email"))
                    .header("api-key", brevoApiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                log.info("Email sent to {} via Brevo", toEmail);
                return true;
            } else {
                log.error("Brevo rejected email to {}: {} {}", toEmail, response.statusCode(), response.body());
                return false;
            }
        } catch (Exception e) {
            log.error("Failed to send email to {} via Brevo: {}", toEmail, e.getMessage());
            return false;
        }
    }

    private LocationInfo fetchLocationDetails(String ip) {
        if (ip == null || ip.equals("127.0.0.1") || ip.equals("0:0:0:0:0:0:0:1")) {
            return new LocationInfo("Localhost", null);
        }
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://ip-api.com/json/" + ip
                            + "?fields=status,message,country,regionName,city,lat,lon"))
                    .GET().build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                JsonNode node = objectMapper.readTree(response.body());
                if ("success".equals(node.get("status").asText())) {
                    String city    = node.has("city")       ? node.get("city").asText()       : "";
                    String region  = node.has("regionName") ? node.get("regionName").asText() : "";
                    String country = node.has("country")    ? node.get("country").asText()    : "";
                    StringBuilder sb = new StringBuilder();
                    if (!city.isBlank())    sb.append(city);
                    if (!region.isBlank())  { if (sb.length() > 0) sb.append(", "); sb.append(region); }
                    if (!country.isBlank()) { if (sb.length() > 0) sb.append(", "); sb.append(country); }
                    String description = sb.length() > 0 ? sb.toString() : "Unknown Location";
                    String mapUrl = null;
                    if (node.has("lat") && node.has("lon")) {
                        mapUrl = String.format("https://www.google.com/maps?q=%s,%s",
                                node.get("lat").asText(), node.get("lon").asText());
                    }
                    return new LocationInfo(description, mapUrl);
                }
            }
        } catch (Exception e) {
            log.warn("Failed to fetch location for IP {}: {}", ip, e.getMessage());
        }
        return new LocationInfo("Unknown Location", null);
    }

    @lombok.Value
    private static class LocationInfo {
        String description;
        String mapUrl;
    }

    // ── GDPR Account Deletion ──────────────────────────────────────────────────

    public void sendDeletionScheduledEmail(String email, String name, java.time.LocalDateTime deletionDate) {
        try {
            org.thymeleaf.context.Context ctx = new org.thymeleaf.context.Context();
            ctx.setVariable("name", name);
            ctx.setVariable("deletionDate", deletionDate.toLocalDate().toString());
            String html = inlineImages(templateEngine.process("email/account-deletion-scheduled", ctx));
            sendViaBrevo("AZA", senderEmail, email,
                    "Your AZA account is scheduled for deletion", html, null, null);
        } catch (Exception e) {
            log.error("Failed to send deletion-scheduled email to {}: {}", email, e.getMessage());
        }
    }

    public void sendDeletionCancelledEmail(String email, String name) {
        try {
            org.thymeleaf.context.Context ctx = new org.thymeleaf.context.Context();
            ctx.setVariable("name", name);
            String html = inlineImages(templateEngine.process("email/account-deletion-cancelled", ctx));
            sendViaBrevo("AZA", senderEmail, email,
                    "Your AZA account deletion has been cancelled", html, null, null);
        } catch (Exception e) {
            log.error("Failed to send deletion-cancelled email to {}: {}", email, e.getMessage());
        }
    }

    public void sendDeletionCompletedEmail(String email, String name) {
        try {
            org.thymeleaf.context.Context ctx = new org.thymeleaf.context.Context();
            ctx.setVariable("name", name != null ? name : "there");
            String html = inlineImages(templateEngine.process("email/account-deletion-completed", ctx));
            sendViaBrevo("AZA", senderEmail, email,
                    "Your AZA account has been deleted", html, null, null);
        } catch (Exception e) {
            log.error("Failed to send deletion-completed email to {}: {}", email, e.getMessage());
        }
    }

    public void sendCheckoutReceiptEmail(String to, String ref, java.math.BigDecimal amount,
                                          String currency, String merchantName, String paidAt) {
        CompletableFuture.runAsync(() -> {
            // Escape all user-supplied values before embedding in HTML to prevent XSS
            String safeMerchant = org.springframework.web.util.HtmlUtils.htmlEscape(merchantName != null ? merchantName : "");
            String safeRef      = org.springframework.web.util.HtmlUtils.htmlEscape(ref != null ? ref : "");
            String safeCurrency = org.springframework.web.util.HtmlUtils.htmlEscape(currency != null ? currency : "");
            String safeAmount   = org.springframework.web.util.HtmlUtils.htmlEscape(amount != null ? amount.toPlainString() : "0");
            String safePaidAt   = org.springframework.web.util.HtmlUtils.htmlEscape(paidAt != null ? paidAt : "");
            // Sanitise subject line: strip CR/LF to block email header injection
            String safeSubject  = ("Payment Receipt – " + safeCurrency + " " + safeAmount + " to " + safeMerchant)
                                      .replaceAll("[\r\n]", "");
            String html = "<html><body style='font-family:sans-serif;background:#111;color:#fff;padding:32px'>" +
                "<div style='max-width:480px;margin:0 auto'>" +
                "<h2 style='color:#B7EE7A'>Payment Receipt</h2>" +
                "<p>Your payment to <strong>" + safeMerchant + "</strong> was successful.</p>" +
                "<table style='width:100%;border-collapse:collapse;margin:20px 0'>" +
                "<tr><td style='padding:8px 0;color:#aaa'>Reference</td><td style='text-align:right;font-family:monospace'>" + safeRef + "</td></tr>" +
                "<tr><td style='padding:8px 0;color:#aaa'>Amount</td><td style='text-align:right;font-weight:700;color:#B7EE7A'>" + safeCurrency + " " + safeAmount + "</td></tr>" +
                "<tr><td style='padding:8px 0;color:#aaa'>Paid to</td><td style='text-align:right'>" + safeMerchant + "</td></tr>" +
                "<tr><td style='padding:8px 0;color:#aaa'>Date</td><td style='text-align:right'>" + safePaidAt + "</td></tr>" +
                "</table>" +
                "<p style='color:#555;font-size:12px'>Powered by AZA</p>" +
                "</div></body></html>";
            sendViaBrevo("AZA", senderEmail, to, safeSubject, html, null, null);
        });
    }
}
