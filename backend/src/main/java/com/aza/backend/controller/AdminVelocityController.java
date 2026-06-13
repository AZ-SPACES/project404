package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.entity.User;
import com.aza.backend.repository.TransactionRepository;
import com.aza.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/admin/risk/velocity-alerts")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','COMPLIANCE')")
public class AdminVelocityController {

    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> velocityAlerts(
            @RequestParam(defaultValue = "1") int hours,
            @RequestParam(defaultValue = "10") long threshold) {
        int effectiveHours = Math.max(1, Math.min(hours, 168)); // max 1 week
        LocalDateTime since = LocalDateTime.now().minusHours(effectiveHours);

        List<Object[]> rows = transactionRepository.findHighVelocitySenders(since, threshold);

        List<UUID> userIds = rows.stream()
                .map(r -> (UUID) r[0])
                .collect(Collectors.toList());

        Map<UUID, User> userMap = userRepository.findAllById(userIds)
                .stream()
                .collect(Collectors.toMap(User::getId, u -> u));

        List<Map<String, Object>> result = rows.stream().map(r -> {
            UUID userId = (UUID) r[0];
            long txCount = ((Number) r[1]).longValue();
            User user = userMap.get(userId);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("userId", userId);
            m.put("txCount", txCount);
            m.put("windowHours", effectiveHours);
            m.put("email", user != null ? user.getEmail() : null);
            m.put("name", user != null ? (user.getFirstName() + " " + user.getLastName()).trim() : null);
            return m;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.success(result));
    }
}
