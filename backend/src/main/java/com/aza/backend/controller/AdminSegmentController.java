package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.entity.User;
import com.aza.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/users/segment")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','COMPLIANCE')")
public class AdminSegmentController {

    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<Page<User>>> segment(
            @RequestParam(required = false) String kycStatus,
            @RequestParam(required = false) String accountStatus,
            @RequestParam(required = false) Boolean twoFactorEnabled,
            @RequestParam(required = false) BigDecimal minBalance,
            @RequestParam(required = false) BigDecimal maxBalance,
            @RequestParam(required = false) Integer lastActiveDays,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        Page<User> result = userRepository.segmentUsers(
                kycStatus != null ? User.KycStatus.valueOf(kycStatus.toUpperCase()) : null,
                accountStatus != null ? User.AccountStatus.valueOf(accountStatus.toUpperCase()) : null,
                twoFactorEnabled,
                minBalance,
                maxBalance,
                lastActiveDays != null ? LocalDateTime.now().minusDays(lastActiveDays) : null,
                PageRequest.of(page, Math.min(size, 50))
        );
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> export(
            @RequestParam(required = false) String kycStatus,
            @RequestParam(required = false) String accountStatus,
            @RequestParam(required = false) Boolean twoFactorEnabled,
            @RequestParam(required = false) BigDecimal minBalance,
            @RequestParam(required = false) BigDecimal maxBalance,
            @RequestParam(required = false) Integer lastActiveDays) {

        // Fetch all matching (up to 5000 rows for export safety)
        Page<User> result = userRepository.segmentUsers(
                kycStatus != null ? User.KycStatus.valueOf(kycStatus.toUpperCase()) : null,
                accountStatus != null ? User.AccountStatus.valueOf(accountStatus.toUpperCase()) : null,
                twoFactorEnabled,
                minBalance,
                maxBalance,
                lastActiveDays != null ? LocalDateTime.now().minusDays(lastActiveDays) : null,
                PageRequest.of(0, 5000)
        );

        List<User> users = result.getContent();
        StringBuilder csv = new StringBuilder();
        csv.append("id,email,phoneNumber,kycStatus,accountStatus,createdAt\n");
        for (User u : users) {
            csv.append(escapeCsv(u.getId().toString())).append(',')
               .append(escapeCsv(u.getEmail())).append(',')
               .append(escapeCsv(u.getPhoneNumber())).append(',')
               .append(escapeCsv(u.getKycStatus() != null ? u.getKycStatus().name() : "")).append(',')
               .append(escapeCsv(u.getStatus() != null ? u.getStatus().name() : "")).append(',')
               .append(escapeCsv(u.getCreatedAt() != null ? u.getCreatedAt().toString() : "")).append('\n');
        }

        byte[] bytes = csv.toString().getBytes(StandardCharsets.UTF_8);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv"));
        headers.set(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=users-segment.csv");
        headers.setContentLength(bytes.length);
        return ResponseEntity.ok().headers(headers).body(bytes);
    }

    private String escapeCsv(String value) {
        if (value == null) return "";
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }
}
