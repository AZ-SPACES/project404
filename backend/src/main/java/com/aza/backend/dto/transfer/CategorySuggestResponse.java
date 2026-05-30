package com.aza.backend.dto.transfer;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class CategorySuggestResponse {
    private String suggestedCategory;
    private double confidence;
    private String reason;
}
