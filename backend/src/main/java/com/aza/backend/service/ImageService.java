package com.aza.backend.service;

import com.aza.backend.entity.UploadedFile;
import com.aza.backend.repository.UploadedFileRepository;
import com.aza.backend.util.CloudinaryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class ImageService {

    private final UploadedFileRepository uploadedFileRepository;
    private final CloudinaryService cloudinaryService;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NORMAL)
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    /**
     * Compute SHA-256 hash of a byte array.
     */
    public String computeSha256(byte[] bytes) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(bytes);
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            log.error("SHA-256 algorithm not found", e);
            throw new RuntimeException("SHA-256 algorithm not available", e);
        }
    }

    /**
     * Download image bytes from an external URL.
     */
    public byte[] downloadImageBytes(String urlString) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(urlString))
                    .timeout(Duration.ofSeconds(15))
                    .GET()
                    .build();

            HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());

            if (response.statusCode() != 200) {
                throw new RuntimeException("Failed to download image: HTTP status " + response.statusCode());
            }

            return response.body();
        } catch (IOException | InterruptedException e) {
            log.error("Failed to download image from URL: {}", urlString, e);
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            throw new RuntimeException("Failed to download image: " + e.getMessage());
        }
    }

    /**
     * Process image bytes: hash, check for duplicates, upload if new, and track reference count.
     */
    @Transactional
    public String processAndDeduplicateImage(byte[] bytes, String folder) {
        if (!isValidImage(bytes)) {
            throw new RuntimeException("Invalid image format. Only JPEG and PNG are allowed.");
        }

        String sha256 = computeSha256(bytes);
        Optional<UploadedFile> existing = uploadedFileRepository.findById(sha256);

        if (existing.isPresent()) {
            UploadedFile file = existing.get();
            file.setReferenceCount(file.getReferenceCount() + 1);
            uploadedFileRepository.save(file);
            log.info("Deduplication match: using existing Cloudinary URL for hash {}", sha256);
            return file.getUrl();
        }

        log.info("No deduplication match for hash {}. Uploading to Cloudinary folder: {}", sha256, folder);
        String url = cloudinaryService.uploadBytes(bytes, folder);

        UploadedFile newFile = UploadedFile.builder()
                .sha256(sha256)
                .url(url)
                .referenceCount(1)
                .build();
        uploadedFileRepository.save(newFile);

        return url;
    }

    /**
     * Process external image URL: download bytes, validate, and deduplicate.
     */
    @Transactional
    public String processExternalUrl(String urlString, String folder) {
        log.info("Processing external image URL: {}", urlString);
        byte[] bytes = downloadImageBytes(urlString);
        return processAndDeduplicateImage(bytes, folder);
    }

    /**
     * Decrement reference count for an image URL if it was uploaded/deduplicated.
     */
    @Transactional
    public void decrementReferenceCount(String url) {
        if (url == null || url.isBlank()) {
            return;
        }
        Optional<UploadedFile> fileOpt = uploadedFileRepository.findByUrl(url);
        if (fileOpt.isPresent()) {
            UploadedFile file = fileOpt.get();
            file.setReferenceCount(file.getReferenceCount() - 1);
            if (file.getReferenceCount() <= 0) {
                log.info("Reference count reached 0 for file {}. Deleting from DB.", file.getSha256());
                uploadedFileRepository.delete(file);
            } else {
                uploadedFileRepository.save(file);
            }
        }
    }

    private boolean isValidImage(byte[] bytes) {
        if (bytes == null || bytes.length < 4) return false;
        
        // JPEG: FF D8 FF
        if (bytes[0] == (byte) 0xFF && bytes[1] == (byte) 0xD8 && bytes[2] == (byte) 0xFF) {
            return true;
        }
        
        // PNG: 89 50 4E 47
        return bytes[0] == (byte) 0x89 && bytes[1] == (byte) 0x50 && bytes[2] == (byte) 0x4E && bytes[3] == (byte) 0x47;
    }
}
