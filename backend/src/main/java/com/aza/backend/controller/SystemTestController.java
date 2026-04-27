package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.util.EmailService;
import com.aza.backend.util.SmsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/system/test")
@RequiredArgsConstructor
public class SystemTestController {

    private final SmsService smsService;
    private final EmailService emailService;

    @PostMapping("/sms")
    public ResponseEntity<ApiResponse<String>> testSms(@RequestBody Map<String, String> request) {
        String phone = request.get("phone");
        String message = request.getOrDefault("message", "AZA Test SMS: Your services are working correctly!");
        
        if (phone == null || phone.isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("BAD_REQUEST", "Phone number is required"));
        }

        boolean success = smsService.sendSms(phone, message);
        if (success) {
            return ResponseEntity.ok(ApiResponse.success("SMS sent successfully. Check Arkesel logs for details."));
        } else {
            return ResponseEntity.status(500).body(ApiResponse.error("INTERNAL_SERVER_ERROR", "Failed to send SMS. Check application logs for details."));
        }
    }

    @PostMapping("/email")
    public ResponseEntity<ApiResponse<String>> testEmail(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        String subject = request.getOrDefault("subject", "AZA System Test");
        String body = request.getOrDefault("body", "<h1>AZA Test</h1><p>Your Resend email service is working correctly!</p>");
        
        if (email == null || email.isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("BAD_REQUEST", "Email is required"));
        }

        boolean success = emailService.sendEmail(email, subject, body);
        if (success) {
            return ResponseEntity.ok(ApiResponse.success("Email sent successfully. Check Resend logs for details."));
        } else {
            return ResponseEntity.status(500).body(ApiResponse.error("INTERNAL_SERVER_ERROR", "Failed to send email. Check application logs for details."));
        }
    }
}
