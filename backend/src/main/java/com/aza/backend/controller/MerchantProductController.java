package com.aza.backend.controller;

import io.swagger.v3.oas.annotations.tags.Tag;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.entity.Merchant;
import com.aza.backend.entity.MerchantProduct;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.MerchantProductRepository;
import com.aza.backend.repository.MerchantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/merchant/products")
@RequiredArgsConstructor
@Tag(name = "Merchant Products", description = "Product catalog management")
public class MerchantProductController {

    private final MerchantProductRepository productRepository;
    private final MerchantRepository merchantRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<Page<MerchantProduct>>> listProducts(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) Boolean active) {
        Merchant merchant = requireMerchant(user.getId());
        Page<MerchantProduct> products = active != null
                ? productRepository.findAllByMerchantIdAndActiveOrderByCreatedAtDesc(merchant.getId(), active, PageRequest.of(page, Math.min(size, 50)))
                : productRepository.findAllByMerchantIdOrderByCreatedAtDesc(merchant.getId(), PageRequest.of(page, Math.min(size, 50)));
        return ResponseEntity.ok(ApiResponse.success(products));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<MerchantProduct>> createProduct(
            @AuthenticationPrincipal User user,
            @RequestBody Map<String, Object> body) {
        Merchant merchant = requireMerchant(user.getId());
        String name = (String) body.get("name");
        if (name == null || name.isBlank()) {
            throw new AppException("VALIDATION", "Product name is required", HttpStatus.BAD_REQUEST);
        }
        Object priceObj = body.get("price");
        if (priceObj == null) {
            throw new AppException("VALIDATION", "Price is required", HttpStatus.BAD_REQUEST);
        }
        BigDecimal price;
        try { price = new BigDecimal(priceObj.toString()); } catch (Exception e) {
            throw new AppException("VALIDATION", "Invalid price", HttpStatus.BAD_REQUEST);
        }
        if (price.compareTo(BigDecimal.ZERO) <= 0) {
            throw new AppException("VALIDATION", "Price must be greater than 0", HttpStatus.BAD_REQUEST);
        }
        String sku = (String) body.get("sku");
        if (sku != null && !sku.isBlank()) {
            if (productRepository.existsByMerchantIdAndSku(merchant.getId(), sku.trim())) {
                throw new AppException("CONFLICT", "A product with this SKU already exists", HttpStatus.CONFLICT);
            }
        }
        MerchantProduct product = MerchantProduct.builder()
                .merchantId(merchant.getId())
                .name(name.trim())
                .description(body.get("description") != null ? ((String) body.get("description")).trim() : null)
                .price(price)
                .currency(body.get("currency") != null ? (String) body.get("currency") : "GHS")
                .imageUrl(body.get("imageUrl") != null ? (String) body.get("imageUrl") : null)
                .sku(sku != null && !sku.isBlank() ? sku.trim() : null)
                .active(true)
                .build();
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(productRepository.save(product)));
    }

    @PutMapping("/{productId}")
    public ResponseEntity<ApiResponse<MerchantProduct>> updateProduct(
            @AuthenticationPrincipal User user,
            @PathVariable UUID productId,
            @RequestBody Map<String, Object> body) {
        Merchant merchant = requireMerchant(user.getId());
        MerchantProduct product = productRepository.findByIdAndMerchantId(productId, merchant.getId())
                .orElseThrow(() -> new AppException("NOT_FOUND", "Product not found", HttpStatus.NOT_FOUND));
        if (body.containsKey("name")) {
            String name = (String) body.get("name");
            if (name == null || name.isBlank()) throw new AppException("VALIDATION", "Name cannot be empty", HttpStatus.BAD_REQUEST);
            product.setName(name.trim());
        }
        if (body.containsKey("description")) {
            product.setDescription(body.get("description") != null ? ((String) body.get("description")).trim() : null);
        }
        if (body.containsKey("price")) {
            try {
                BigDecimal price = new BigDecimal(body.get("price").toString());
                if (price.compareTo(BigDecimal.ZERO) <= 0) throw new AppException("VALIDATION", "Price must be > 0", HttpStatus.BAD_REQUEST);
                product.setPrice(price);
            } catch (NumberFormatException e) {
                throw new AppException("VALIDATION", "Invalid price", HttpStatus.BAD_REQUEST);
            }
        }
        if (body.containsKey("imageUrl")) {
            product.setImageUrl((String) body.get("imageUrl"));
        }
        if (body.containsKey("sku")) {
            String sku = (String) body.get("sku");
            String newSku = (sku != null && !sku.isBlank()) ? sku.trim() : null;
            if (newSku != null && !newSku.equals(product.getSku()) && productRepository.existsByMerchantIdAndSku(merchant.getId(), newSku)) {
                throw new AppException("CONFLICT", "A product with this SKU already exists", HttpStatus.CONFLICT);
            }
            product.setSku(newSku);
        }
        if (body.containsKey("active")) {
            product.setActive(Boolean.TRUE.equals(body.get("active")));
        }
        return ResponseEntity.ok(ApiResponse.success(productRepository.save(product)));
    }

    @DeleteMapping("/{productId}")
    public ResponseEntity<ApiResponse<Void>> deleteProduct(
            @AuthenticationPrincipal User user,
            @PathVariable UUID productId) {
        Merchant merchant = requireMerchant(user.getId());
        MerchantProduct product = productRepository.findByIdAndMerchantId(productId, merchant.getId())
                .orElseThrow(() -> new AppException("NOT_FOUND", "Product not found", HttpStatus.NOT_FOUND));
        productRepository.delete(product);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    private Merchant requireMerchant(UUID userId) {
        return merchantRepository.findByUserId(userId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "No merchant account found", HttpStatus.NOT_FOUND));
    }
}
