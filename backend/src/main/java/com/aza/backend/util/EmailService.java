package com.aza.backend.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
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

    private String logoBase64;

    private String getLogoBase64() {
        if (logoBase64 == null) {
            try {
                byte[] bytes = new ClassPathResource("static/images/paper-plane.png")
                        .getInputStream().readAllBytes();
                logoBase64 = "data:image/png;base64," + Base64.getEncoder().encodeToString(bytes);
            } catch (Exception e) {
                log.warn("Could not load paper-plane logo: {}", e.getMessage());
                logoBase64 = "";
            }
        }
        return logoBase64;
    }

    private String inlineImages(String html) {
        return html.replace("src=\"cid:paperplane\"", "src=\"" + getLogoBase64() + "\"");
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
}
