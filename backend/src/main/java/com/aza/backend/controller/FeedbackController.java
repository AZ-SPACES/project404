package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.SubmitFeedbackRequest;
import com.aza.backend.entity.User;
import com.aza.backend.service.FeedbackService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/** In-app product feedback (rating + optional comment). */
@RestController
@RequestMapping("/api/v1/feedback")
@RequiredArgsConstructor
public class FeedbackController {

    private final FeedbackService feedbackService;

    @PostMapping
    public ResponseEntity<ApiResponse<Void>> submit(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody SubmitFeedbackRequest request) {
        feedbackService.submit(user, request);
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
