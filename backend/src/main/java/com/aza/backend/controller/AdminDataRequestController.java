package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.admin.DataRequestResponse;
import com.aza.backend.entity.DataRequest;
import com.aza.backend.entity.User;
import com.aza.backend.service.DataRequestService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.SneakyThrows;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/data-requests")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','COMPLIANCE','SUPPORT')")
public class AdminDataRequestController {

    private final DataRequestService dataRequestService;
    private final ObjectMapper objectMapper;

    @GetMapping
    public ResponseEntity<ApiResponse<Page<DataRequestResponse>>> list(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                dataRequestService.list(status, page, Math.min(size, 50))));
    }

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<Map<String, Long>>> stats() {
        return ResponseEntity.ok(ApiResponse.success(Map.of("open", dataRequestService.openCount())));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<DataRequestResponse>> create(
            @RequestBody CreateRequest request,
            @AuthenticationPrincipal User admin) {
        return ResponseEntity.ok(ApiResponse.success(dataRequestService.create(
                admin, request.getUserId(),
                DataRequest.RequestType.valueOf(request.getType().toUpperCase()),
                request.getNotes())));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<ApiResponse<DataRequestResponse>> updateStatus(
            @PathVariable UUID id,
            @RequestBody StatusRequest request,
            @AuthenticationPrincipal User admin) {
        return ResponseEntity.ok(ApiResponse.success(dataRequestService.updateStatus(
                admin, id, DataRequest.Status.valueOf(request.getStatus().toUpperCase()), request.getNotes())));
    }

    /** The downloadable ACCESS bundle handed to the requester. */
    @SneakyThrows
    @GetMapping(value = "/user/{userId}/export", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> export(
            @PathVariable UUID userId,
            @AuthenticationPrincipal User admin) {
        Map<String, Object> bundle = dataRequestService.exportUserData(admin, userId);
        String json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(bundle);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"user-data-" + userId + ".json\"")
                .body(json);
    }

    @Data
    static class CreateRequest {
        private UUID userId;
        private String type;
        private String notes;
    }

    @Data
    static class StatusRequest {
        private String status;
        private String notes;
    }
}
