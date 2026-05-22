package com.aza.backend.util;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

@Service
@Slf4j
public class CloudinaryService {

    private final Cloudinary cloudinary;

    public CloudinaryService(
            @Value("${cloudinary.cloud-name}") String cloudName,
            @Value("${cloudinary.api-key}") String apiKey,
            @Value("${cloudinary.api-secret}") String apiSecret) {
        this.cloudinary = new Cloudinary(ObjectUtils.asMap(
                "cloud_name", cloudName,
                "api_key", apiKey,
                "api_secret", apiSecret
        ));
    }

    /**
     * Upload profile image — resized to 256x256
     */
    public String uploadProfileImage(MultipartFile file) {
        return upload(file, "aza/profile-images", "c_fill,w_256,h_256");
    }

    /**
     * Upload KYC ID document (front or back)
     */
    public String uploadKycDocument(MultipartFile file, String userId) {
        return upload(file, "aza/kyc/" + userId, null);
    }

    /**
     * Upload KYC selfie
     */
    public String uploadKycSelfie(MultipartFile file, String userId) {
        return upload(file, "aza/kyc/" + userId, null);
    }

    /**
     * Upload KYC proof-of-wealth document
     */
    public String uploadKycProofDocument(MultipartFile file, String userId) {
        return upload(file, "aza/kyc/" + userId, null);
    }

    /**
     * Upload chat media (image, video, audio, document).
     * resource_type=auto lets Cloudinary detect and transcode correctly.
     */
    public String uploadChatMedia(MultipartFile file, String chatId) {
        return upload(file, "aza/chat-media/" + chatId, null);
    }

    /**
     * Upload raw bytes to Cloudinary
     */
    public String uploadBytes(byte[] bytes, String folder) {
        try {
            Map<String, Object> params = new HashMap<>();
            params.put("folder", folder);
            params.put("resource_type", "auto");

            @SuppressWarnings("unchecked")
            Map<String, Object> result = cloudinary.uploader().upload(bytes, params);
            String url = (String) result.get("secure_url");
            log.info("Cloudinary uploadBytes success: folder={}", folder);
            return url;
        } catch (IOException e) {
            log.error("Cloudinary uploadBytes failed: {}", e.getMessage());
            throw new RuntimeException("Failed to upload file");
        }
    }

    /**
     * Core upload method used by all upload types
     */
    private String upload(MultipartFile file, String folder, String transformation) {
        try {
            Map<String, Object> params = new HashMap<>();
            params.put("folder", folder);
            params.put("resource_type", "auto"); // supports images and PDFs

            if (transformation != null) {
                params.put("transformation", transformation);
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> result = cloudinary.uploader().upload(file.getBytes(), params);
            String url = (String) result.get("secure_url");
            log.info("Cloudinary upload success: folder={}", folder);
            return url;
        } catch (IOException e) {
            log.error("Cloudinary upload failed: {}", e.getMessage());
            throw new RuntimeException("Failed to upload file");
        }
    }
}