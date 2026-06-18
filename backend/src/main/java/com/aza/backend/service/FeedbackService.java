package com.aza.backend.service;

import com.aza.backend.dto.SubmitFeedbackRequest;
import com.aza.backend.entity.Feedback;
import com.aza.backend.entity.User;
import com.aza.backend.repository.FeedbackRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
@RequiredArgsConstructor
public class FeedbackService {

    private final FeedbackRepository feedbackRepository;

    public void submit(User user, SubmitFeedbackRequest request) {
        Feedback feedback = Feedback.builder()
                .userId(user.getId())
                .rating(request.getRating())
                .comment(request.getComment())
                .context(request.getContext())
                .build();
        feedbackRepository.save(feedback);
        log.info("Feedback submitted by user {}: rating={} context={}",
                user.getId(), request.getRating(), request.getContext());
    }
}
