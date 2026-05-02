package com.aza.backend.util;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.concurrent.CompletableFuture;

@Service
@Slf4j
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;
    private final TemplateEngine templateEngine;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(java.time.Duration.ofSeconds(3))
            .build();

    @Value("${spring.mail.username}")
    private String fromEmail;

    /**
     * Send an email via Gmail SMTP
     */
    public boolean sendEmail(String to, String subject, String htmlBody) {
        try {
            log.info("Sending email to {} via Gmail SMTP...", to);
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom("AZA <" + fromEmail + ">");
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlBody, true);

            mailSender.send(message);
            log.info("Email sent successfully to {}", to);
            return true;
        } catch (Exception e) {
            log.error("Failed to send email to {}: {}", to, e.getMessage());
            return false;
        }
    }

    /**
     * Send OTP via email using Thymeleaf template with inline image
     */
    public boolean sendOtp(String email, String otp) {
        String subject = "AZA - Your Verification Code";
        
        try {
            log.info("Preparing OTP email for {}...", email);
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom("AZA <" + fromEmail + ">");
            helper.setTo(email);
            helper.setSubject(subject);

            Context context = new Context();
            context.setVariable("otp", otp);
            // We'll use 'logo' as the CID in the template
            String htmlContent = templateEngine.process("email/otp-template", context);
            helper.setText(htmlContent, true);

            // Add the paper-plane logo as an inline resource
            ClassPathResource res = new ClassPathResource("static/images/paper-plane.png");
            helper.addInline("paperplane", res);

            mailSender.send(message);
            log.info("OTP email sent successfully to {}", email);
            return true;
        } catch (Exception e) {
            log.error("Failed to send OTP email to {}: {}", email, e.getMessage());
            return false;
        }
    }

    /**
     * Send signup welcome email asynchronously
     */
    public void sendSignupNotification(String email, String name) {
        CompletableFuture.runAsync(() -> {
            String subject = "Welcome to AZA!";
            try {
                log.info("Preparing Signup Notification email for {}...", email);
                MimeMessage message = mailSender.createMimeMessage();
                MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

                helper.setFrom("AZA <" + fromEmail + ">");
                helper.setTo(email);
                helper.setSubject(subject);

                Context context = new Context();
                context.setVariable("name", name);

                String htmlContent = templateEngine.process("email/signup-notification", context);
                helper.setText(htmlContent, true);

                ClassPathResource res = new ClassPathResource("static/images/paper-plane.png");
                helper.addInline("paperplane", res);

                mailSender.send(message);
                log.info("Signup Notification email sent successfully to {}", email);
            } catch (MessagingException e) {
                log.error("Failed to send signup notification to {}: {}", email, e.getMessage());
            } catch (Exception e) {
                log.error("Unexpected error sending signup notification to {}: {}", email, e.getMessage());
            }
        });
    }

    /**
     * Send login notification email asynchronously to avoid blocking the calling thread.
     * The geo-IP lookup and SMTP send happen off the request thread.
     */
    public void sendLoginNotification(String email, String name, String deviceName, String deviceOs, String ipAddress) {
        CompletableFuture.runAsync(() -> {
            String subject = "Security Alert: New Login to your AZA Account";
            try {
                log.info("Preparing Login Notification email for {}...", email);
                MimeMessage message = mailSender.createMimeMessage();
                MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

                helper.setFrom("AZA Security <" + fromEmail + ">");
                helper.setTo(email);
                helper.setSubject(subject);

                Context context = new Context();
                context.setVariable("name", name);
                context.setVariable("deviceName", deviceName);
                context.setVariable("deviceOs", deviceOs);
                context.setVariable("ipAddress", ipAddress);
                
                LocationInfo loc = fetchLocationDetails(ipAddress);
                context.setVariable("location", loc.getDescription());
                context.setVariable("mapUrl", loc.getMapUrl());
                
                context.setVariable("loginTime", java.time.LocalDateTime.now()
                        .format(java.time.format.DateTimeFormatter.ofPattern("MMM dd, yyyy HH:mm")));

                String htmlContent = templateEngine.process("email/login-notification", context);
                helper.setText(htmlContent, true);

                ClassPathResource res = new ClassPathResource("static/images/paper-plane.png");
                helper.addInline("paperplane", res);

                mailSender.send(message);
                log.info("Login Notification email sent successfully to {}", email);
            } catch (MessagingException e) {
                log.error("Failed to send login notification to {}: {}", email, e.getMessage());
            } catch (Exception e) {
                log.error("Unexpected error sending login notification to {}: {}", email, e.getMessage());
            }
        });
    }

    /**
     * Send KYC status update email
     */
    public void sendKycStatusEmail(String email, String name, boolean approved, String reason) {
        CompletableFuture.runAsync(() -> {
            String subject = approved ? "AZA - Verification Successful" : "AZA - Verification Update Required";
            try {
                log.info("Preparing KYC Status email for {} (approved: {})...", email, approved);
                MimeMessage message = mailSender.createMimeMessage();
                MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

                helper.setFrom("AZA Support <" + fromEmail + ">");
                helper.setTo(email);
                helper.setSubject(subject);

                Context context = new Context();
                context.setVariable("name", name);
                context.setVariable("approved", approved);
                context.setVariable("reason", reason);

                String htmlContent = templateEngine.process("email/kyc-status", context);
                helper.setText(htmlContent, true);

                ClassPathResource res = new ClassPathResource("static/images/paper-plane.png");
                helper.addInline("paperplane", res);

                mailSender.send(message);
                log.info("KYC Status email sent successfully to {}", email);
            } catch (MessagingException e) {
                log.error("Failed to send KYC status email to {}: {}", email, e.getMessage());
            } catch (Exception e) {
                log.error("Unexpected error sending KYC status email to {}: {}", email, e.getMessage());
            }
        });
    }

    /**
     * Send email when a bill is forwarded and processed as a draft
     */
    public void sendBillReceivedEmail(String email, String name, String merchantName, java.math.BigDecimal amount) {
        CompletableFuture.runAsync(() -> {
            String subject = "AZA - New Bill Received from " + merchantName;
            try {
                log.info("Preparing Bill Received email for {}...", email);
                MimeMessage message = mailSender.createMimeMessage();
                MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

                helper.setFrom("AZA Bills <" + fromEmail + ">");
                helper.setTo(email);
                helper.setSubject(subject);

                Context context = new Context();
                context.setVariable("name", name);
                context.setVariable("merchantName", merchantName);
                context.setVariable("amount", amount);
                context.setVariable("date", java.time.LocalDateTime.now()
                        .format(java.time.format.DateTimeFormatter.ofPattern("MMM dd, yyyy")));

                String htmlContent = templateEngine.process("email/bill-received", context);
                helper.setText(htmlContent, true);

                ClassPathResource res = new ClassPathResource("static/images/paper-plane.png");
                helper.addInline("paperplane", res);

                mailSender.send(message);
                log.info("Bill Received email sent successfully to {}", email);
            } catch (MessagingException e) {
                log.error("Failed to send bill received email to {}: {}", email, e.getMessage());
            } catch (Exception e) {
                log.error("Unexpected error sending bill received email to {}: {}", email, e.getMessage());
            }
        });
    }

    /**
     * Fetch detailed location from IP address
     */
    private LocationInfo fetchLocationDetails(String ip) {
        if (ip == null || ip.equals("127.0.0.1") || ip.equals("0:0:0:0:0:0:0:1")) {
            return new LocationInfo("Localhost", null);
        }
        
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://ip-api.com/json/" + ip + "?fields=status,message,country,regionName,city,lat,lon"))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            
            if (response.statusCode() == 200) {
                JsonNode node = objectMapper.readTree(response.body());
                if ("success".equals(node.get("status").asText())) {
                    String city = node.has("city") ? node.get("city").asText() : "";
                    String region = node.has("regionName") ? node.get("regionName").asText() : "";
                    String country = node.has("country") ? node.get("country").asText() : "";
                    
                    StringBuilder sb = new StringBuilder();
                    if (!city.isBlank()) sb.append(city);
                    if (!region.isBlank()) {
                        if (sb.length() > 0) sb.append(", ");
                        sb.append(region);
                    }
                    if (!country.isBlank()) {
                        if (sb.length() > 0) sb.append(", ");
                        sb.append(country);
                    }
                    
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
