package com.aza.backend.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.util.StringUtils;

import jakarta.annotation.PostConstruct;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

@Configuration
@Slf4j
public class FirebaseConfig {

    @Value("${firebase.credentials-path:firebase-service-account.json}")
    private String credentialsPath;

    @Value("${firebase.credentials-json:}")
    private String credentialsJson;

    @Value("${firebase.credentials-base64:}")
    private String credentialsBase64;

    @PostConstruct
    public void initializeFirebase() {
        try {
            if (FirebaseApp.getApps().isEmpty()) {
                byte[] credentialsBytes = null;

                // 1. Try loading from direct JSON string
                if (StringUtils.hasText(credentialsJson)) {
                    log.info("Initializing Firebase using credentials JSON string");
                    credentialsBytes = credentialsJson.getBytes(StandardCharsets.UTF_8);
                }
                // 2. Try loading from Base64 encoded JSON string
                else if (StringUtils.hasText(credentialsBase64)) {
                    log.info("Initializing Firebase using Base64 encoded credentials JSON");
                    try {
                        credentialsBytes = Base64.getDecoder().decode(credentialsBase64.trim());
                    } catch (IllegalArgumentException e) {
                        log.error("Failed to decode Base64 firebase credentials: {}", e.getMessage());
                    }
                }

                // 3. Fallback to file path
                if (credentialsBytes == null) {
                    try (InputStream fileStream = getCredentialsStream(credentialsPath)) {
                        if (fileStream != null) {
                            credentialsBytes = fileStream.readAllBytes();
                        }
                    } catch (IOException e) {
                        log.warn("Failed to read Firebase credentials file: {}", e.getMessage());
                    }
                }

                if (credentialsBytes == null) {
                    log.warn("Firebase credentials not found — push notifications will be disabled");
                    return;
                }

                String credentialsStr = new String(credentialsBytes, StandardCharsets.UTF_8);
                if (credentialsStr.contains("\"placeholder\"") || credentialsStr.trim().isEmpty()) {
                    log.warn("Firebase credentials contain placeholders or are empty — push notifications will be disabled");
                    return;
                }

                FirebaseOptions options = FirebaseOptions.builder()
                        .setCredentials(GoogleCredentials.fromStream(new ByteArrayInputStream(credentialsBytes)))
                        .build();

                FirebaseApp.initializeApp(options);
                log.info("Firebase Admin SDK initialized successfully");
            }
        } catch (Exception e) {
            log.error("Failed to initialize Firebase: {}", e.getMessage());
        }
    }

    private InputStream getCredentialsStream(String path) {
        try {
            return new ClassPathResource(path).getInputStream();
        } catch (IOException e) {
            java.io.File file = new java.io.File(path);
            if (file.exists()) {
                try {
                    return new java.io.FileInputStream(file);
                } catch (IOException ex) {
                    return null;
                }
            }
        }
        return null;
    }
}
