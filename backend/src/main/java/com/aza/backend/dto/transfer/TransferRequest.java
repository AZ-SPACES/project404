package com.aza.backend.dto.transfer;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class TransferRequest {

    @NotBlank(message = "Recipient identifier is required")
    private String recipientIdentifier;  // email, phone, or userId

    /**
     * "MERCHANT" when the payer scanned a store code and knows they are paying a
     * business. Absent or "USER" keeps the ordinary lookup order (person, then shop).
     * Sending it removes the ambiguity of a handle that exists in both namespaces.
     */
    @Size(max = 16)
    private String recipientType;

    /** Till / branch / cashier the store QR was printed for. Merchant payments only. */
    @Size(max = 40)
    private String terminalId;

    @NotNull(message = "Amount is required")
    @DecimalMin(value = "0.01", message = "Amount must be greater than 0")
    @DecimalMax(value = "999999.99", message = "Amount exceeds maximum allowed")
    private BigDecimal amount;

    @Size(max = 500, message = "Note cannot exceed 500 characters")
    private String note;

    @NotBlank(message = "Idempotency key is required")
    private String idempotencyKey;

    private String category;

    @Size(max = 255)
    private String gpsLocation;
}
