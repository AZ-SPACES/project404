package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.entity.DeviceBlock;
import com.aza.backend.entity.User;
import com.aza.backend.service.DeviceService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/devices")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','COMPLIANCE','SUPPORT')")
public class AdminDeviceController {

    private final DeviceService deviceService;

    /** All known devices — one row per distinct deviceId, most recently active first. */
    @GetMapping
    public ResponseEntity<ApiResponse<Page<DeviceService.DeviceRegistryRow>>> registry(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(deviceService.getDeviceRegistry(page, size)));
    }

    /** Devices seen on more than {@code threshold} distinct user accounts — potential account takeover. */
    @GetMapping("/suspicious")
    public ResponseEntity<ApiResponse<List<DeviceService.SuspiciousDeviceRow>>> suspicious(
            @RequestParam(defaultValue = "1") long threshold) {
        return ResponseEntity.ok(ApiResponse.success(deviceService.getSuspiciousDevices(threshold)));
    }

    /** All currently blocked devices. */
    @GetMapping("/blocked")
    public ResponseEntity<ApiResponse<List<DeviceBlock>>> blocked() {
        return ResponseEntity.ok(ApiResponse.success(deviceService.listBlocked()));
    }

    /**
     * Block a device by its client-generated deviceId.
     * Immediately kills all active sessions on that device and prevents future logins.
     */
    @PreAuthorize("hasAnyRole('ADMIN','COMPLIANCE')")
    @PostMapping("/{deviceId}/block")
    public ResponseEntity<ApiResponse<DeviceBlock>> block(
            @PathVariable String deviceId,
            @RequestBody BlockRequest request,
            @AuthenticationPrincipal User admin) {
        DeviceBlock block = deviceService.blockDevice(
                admin,
                deviceId,
                request.getAssociatedUserId(),
                request.getDeviceName(),
                request.getDeviceOs(),
                request.getReason());
        return ResponseEntity.ok(ApiResponse.success(block));
    }

    /** Remove a device block — the device can log in again. */
    @PreAuthorize("hasAnyRole('ADMIN','COMPLIANCE')")
    @DeleteMapping("/{deviceId}/block")
    public ResponseEntity<ApiResponse<String>> unblock(
            @PathVariable String deviceId,
            @AuthenticationPrincipal User admin) {
        deviceService.unblockDevice(admin, deviceId);
        return ResponseEntity.ok(ApiResponse.success("Device unblocked"));
    }

    @Data
    static class BlockRequest {
        private UUID associatedUserId;
        private String deviceName;
        private String deviceOs;
        private String reason;
    }
}
