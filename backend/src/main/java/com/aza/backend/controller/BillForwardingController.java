package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.service.BillForwardingService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;

@RestController
@RequestMapping("/api/v1/internal/bills")
@RequiredArgsConstructor
public class BillForwardingController {

    private final BillForwardingService billForwardingService;

    /**
     * Internal endpoint to simulate receiving a bill via email parse (using handle).
     */
    @PostMapping("/simulate")
    public ResponseEntity<ApiResponse<String>> simulateBillReceived(@RequestBody BillSimulationRequest request) {
        billForwardingService.processIncomingBill(
                request.getIdentifier(), // used as handle
                request.getSubject(),
                request.getAmount(),
                request.getMerchantName()
        );
        return ResponseEntity.ok(ApiResponse.success("Simulation triggered"));
    }

    /**
     * Internal endpoint to simulate receiving a bill via email parse (using registered email).
     */
    @PostMapping("/simulate/email")
    public ResponseEntity<ApiResponse<String>> simulateBillReceivedByEmail(@RequestBody BillSimulationRequest request) {
        billForwardingService.processIncomingBillByEmail(
                request.getIdentifier(), // used as email
                request.getSubject(),
                request.getAmount(),
                request.getMerchantName()
        );
        return ResponseEntity.ok(ApiResponse.success("Simulation triggered"));
    }

    @Data
    public static class BillSimulationRequest {
        private String identifier;
        private String subject;
        private BigDecimal amount;
        private String merchantName;
    }
}
