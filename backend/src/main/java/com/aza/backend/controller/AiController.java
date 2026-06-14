package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.ai.AiChatRequest;
import com.aza.backend.dto.ai.AiChatResponse;
import com.aza.backend.dto.ai.AiInsightRequest;
import com.aza.backend.dto.ai.AiInsightResponse;
import com.aza.backend.entity.User;
import com.aza.backend.service.AiService;
import lombok.RequiredArgsConstructor;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiService aiService;

    @PostMapping("/insight")
    public ResponseEntity<ApiResponse<AiInsightResponse>> getInsight(
            @AuthenticationPrincipal User user,
            @RequestBody AiInsightRequest request) {
        if (request.getTransactionId() == null || request.getTransactionId().isBlank()) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("INVALID_REQUEST", "transactionId is required"));
        }
        UUID txId;
        try {
            txId = UUID.fromString(request.getTransactionId());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("INVALID_REQUEST", "Invalid transactionId format"));
        }
        String insight = aiService.generateTransferInsight(user.getId(), txId);
        return ResponseEntity.ok(ApiResponse.success(new AiInsightResponse(insight)));
    }

    @GetMapping("/chatbase-token")
    public ResponseEntity<ApiResponse<Map<String, String>>> getChatbaseToken(
            @AuthenticationPrincipal User user) {
        String token = aiService.generateChatbaseToken(user.getId(), user.getEmail());
        if (token == null) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(ApiResponse.error("CHATBASE_UNAVAILABLE", "Chatbase identity not configured"));
        }
        return ResponseEntity.ok(ApiResponse.success(Map.of("token", token)));
    }

    @PostMapping("/chat")
    public ResponseEntity<ApiResponse<AiChatResponse>> chat(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody AiChatRequest request) {
        String response = aiService.chat(user.getId(), request.getMessage(), request.getHistory());
        if (response == null) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(ApiResponse.error("AI_UNAVAILABLE", "AI service is temporarily unavailable"));
        }
        return ResponseEntity.ok(ApiResponse.success(new AiChatResponse(response)));
    }
}
