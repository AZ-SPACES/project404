package com.aza.backend.repository;

import com.aza.backend.entity.KybDocument;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface KybDocumentRepository extends JpaRepository<KybDocument, UUID> {

    List<KybDocument> findAllByMerchantId(UUID merchantId);

    boolean existsByMerchantIdAndType(UUID merchantId, KybDocument.DocumentType type);
}
