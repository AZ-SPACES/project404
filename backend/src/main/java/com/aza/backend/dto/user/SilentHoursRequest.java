package com.aza.backend.dto.user;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class SilentHoursRequest {

    @NotNull(message = "enabled is required")
    private Boolean enabled;

    /** HH:mm format, 24-hour clock. Required when enabled=true. */
    @Pattern(regexp = "^([01]\\d|2[0-3]):([0-5]\\d)$", message = "startTime must be in HH:mm format")
    private String startTime;

    /** HH:mm format, 24-hour clock. Required when enabled=true. */
    @Pattern(regexp = "^([01]\\d|2[0-3]):([0-5]\\d)$", message = "endTime must be in HH:mm format")
    private String endTime;

    /**
     * Minimum payment request amount (GHS) that breaks through silent hours.
     * Null = no payment notifications break through.
     * 0 = all payment notifications break through.
     */
    @DecimalMin(value = "0", message = "paymentThreshold must be >= 0")
    private BigDecimal paymentThreshold;
}
