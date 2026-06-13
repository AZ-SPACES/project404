package com.aza.backend.service;

import com.aza.backend.dto.merchant.KybDocumentResponse;
import com.aza.backend.entity.KybDocument;
import com.aza.backend.entity.Merchant;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.KybDocumentRepository;
import com.aza.backend.repository.MerchantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class MobileKybService {

    private static final String PREFIX = "mobile-kyb:";
    private static final Duration TTL = Duration.ofMinutes(15);

    private static final List<String> ALL_DOC_TYPES = List.of(
            "CERTIFICATE_OF_INCORPORATION",
            "TAX_CERTIFICATE",
            "PROOF_OF_ADDRESS",
            "OWNER_ID_FRONT",
            "OWNER_ID_BACK"
    );

    private final StringRedisTemplate redis;
    private final MerchantRepository merchantRepository;
    private final KybDocumentRepository kybDocumentRepository;
    private final MerchantService merchantService;

    /** Generate a 15-minute handoff token tied to this merchant's userId. */
    public String generateToken(UUID userId) {
        String token = UUID.randomUUID().toString().replace("-", "");
        redis.opsForValue().set(PREFIX + token, userId.toString(), TTL);
        return token;
    }

    /** Resolve token → merchant, throwing 404 if expired/invalid. */
    public Merchant resolveToken(String token) {
        String userId = redis.opsForValue().get(PREFIX + token);
        if (userId == null) throw new AppException("Mobile session expired or invalid. Please request a new QR code.");
        UUID uid = UUID.fromString(userId);
        return merchantRepository.findByUserId(uid)
                .orElseThrow(() -> new AppException("Merchant not found"));
    }

    /** Upload a KYB document on behalf of the mobile session. */
    public KybDocumentResponse uploadDocument(String token, MultipartFile file, String docType) {
        Merchant merchant = resolveToken(token);
        return merchantService.uploadKybDocument(merchant.getUserId(), file, docType);
    }

    /** Return doc types already uploaded for this merchant. */
    public Set<String> uploadedDocTypes(String token) {
        Merchant merchant = resolveToken(token);
        return kybDocumentRepository.findAllByMerchantId(merchant.getId())
                .stream()
                .map(doc -> doc.getType().name())
                .collect(Collectors.toSet());
    }

    /** Return document types not yet uploaded. */
    public List<String> pendingDocTypes(String token) {
        Set<String> uploaded = uploadedDocTypes(token);
        return ALL_DOC_TYPES.stream().filter(t -> !uploaded.contains(t)).toList();
    }

    public String getBusinessName(String token) {
        return resolveToken(token).getBusinessName();
    }
}
