package com.aza.backend.service;

import dev.samstevens.totp.code.*;
import dev.samstevens.totp.qr.QrData;
import dev.samstevens.totp.qr.ZxingPngQrGenerator;
import dev.samstevens.totp.secret.DefaultSecretGenerator;
import dev.samstevens.totp.time.SystemTimeProvider;
import dev.samstevens.totp.time.TimeProvider;
import org.springframework.stereotype.Service;
import java.util.Base64;

@Service
public class TotpService {

    public String generateSecret() {
        return new DefaultSecretGenerator().generate();
    }

    public String getQrUri(String secret, String accountName, String issuer) {
        QrData data = new QrData.Builder()
                .label(accountName)
                .secret(secret)
                .issuer(issuer)
                .algorithm(HashingAlgorithm.SHA1)
                .digits(6)
                .period(30)
                .build();
        return data.getUri();
    }

    public String generateQrCodeBase64(String secret, String accountName, String issuer) {
        QrData data = new QrData.Builder()
                .label(accountName)
                .secret(secret)
                .issuer(issuer)
                .algorithm(HashingAlgorithm.SHA1)
                .digits(6)
                .period(30)
                .build();
        try {
            byte[] imageBytes = new ZxingPngQrGenerator().generate(data);
            return Base64.getEncoder().encodeToString(imageBytes);
        } catch (Exception e) {
            throw new com.aza.backend.exception.AppException("Failed to generate QR code", e);
        }
    }

    public boolean isCodeInvalid(String secret, String code) {
        if (secret == null || code == null || !code.matches("\\d{6}")) return true;
        TimeProvider timeProvider = new SystemTimeProvider();
        CodeGenerator codeGenerator = new DefaultCodeGenerator(HashingAlgorithm.SHA1, 6);
        DefaultCodeVerifier verifier = new DefaultCodeVerifier(codeGenerator, timeProvider);
        verifier.setAllowedTimePeriodDiscrepancy(1); // ±30s clock skew tolerance
        return !verifier.isValidCode(secret, code);
    }
}
