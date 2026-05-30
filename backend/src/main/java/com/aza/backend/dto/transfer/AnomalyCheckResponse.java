package com.aza.backend.dto.transfer;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class AnomalyCheckResponse {
    private double score;
    private String riskLevel;
    private String reason;
}
