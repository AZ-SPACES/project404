package com.aza.backend.util;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
@Slf4j
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

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
        } catch (MessagingException e) {
            log.error("Failed to send email to {}: {}", to, e.getMessage());
            return false;
        }
    }

    /**
     * Send OTP via email
     */
    public boolean sendOtp(String email, String otp) {
        String subject = "AZA - Your Verification Code";
        String html = """
                <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #1a1a2e; text-align: center;">AZA</h2>
                    <p>Your verification code is:</p>
                    <div style="background: #f0f0f0; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a1a2e;">%s</span>
                    </div>
                    <p style="color: #666; font-size: 14px;">This code expires in 5 minutes. Do not share it with anyone.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #999; font-size: 12px; text-align: center;">If you didn't request this code, please ignore this email.</p>
                </div>
                """.formatted(otp);

        return sendEmail(email, subject, html);
    }
}
