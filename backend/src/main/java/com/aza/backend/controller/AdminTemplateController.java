package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.entity.EmailTemplate;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.EmailTemplateRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/templates")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminTemplateController {

    private final EmailTemplateRepository templateRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<List<EmailTemplate>>> list() {
        return ResponseEntity.ok(ApiResponse.success(templateRepository.findAll()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<EmailTemplate>> get(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(
                templateRepository.findById(id)
                        .orElseThrow(() -> new AppException("TEMPLATE_NOT_FOUND", "Template not found", HttpStatus.NOT_FOUND))));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<EmailTemplate>> create(
            @RequestBody TemplateRequest request,
            @AuthenticationPrincipal User admin) {
        if (templateRepository.existsByTemplateKey(request.getTemplateKey())) {
            throw new AppException("TEMPLATE_KEY_EXISTS", "A template with this key already exists", HttpStatus.CONFLICT);
        }
        EmailTemplate t = EmailTemplate.builder()
                .templateKey(request.getTemplateKey())
                .subject(request.getSubject())
                .body(request.getBody())
                .updatedBy(admin.getEmail())
                .build();
        return ResponseEntity.ok(ApiResponse.success(templateRepository.save(t)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<EmailTemplate>> update(
            @PathVariable UUID id,
            @RequestBody TemplateRequest request,
            @AuthenticationPrincipal User admin) {
        EmailTemplate t = templateRepository.findById(id)
                .orElseThrow(() -> new AppException("TEMPLATE_NOT_FOUND", "Template not found", HttpStatus.NOT_FOUND));

        if (!t.getTemplateKey().equals(request.getTemplateKey())
                && templateRepository.existsByTemplateKey(request.getTemplateKey())) {
            throw new AppException("TEMPLATE_KEY_EXISTS", "A template with this key already exists", HttpStatus.CONFLICT);
        }

        t.setTemplateKey(request.getTemplateKey());
        t.setSubject(request.getSubject());
        t.setBody(request.getBody());
        t.setUpdatedBy(admin.getEmail());
        return ResponseEntity.ok(ApiResponse.success(templateRepository.save(t)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<String>> delete(@PathVariable UUID id) {
        if (!templateRepository.existsById(id)) {
            throw new AppException("TEMPLATE_NOT_FOUND", "Template not found", HttpStatus.NOT_FOUND);
        }
        templateRepository.deleteById(id);
        return ResponseEntity.ok(ApiResponse.success("Template deleted"));
    }

    @Data
    static class TemplateRequest {
        private String templateKey;
        private String subject;
        private String body;
    }
}
