package com.aza.backend.dto.transfer;

import lombok.Data;

@Data
public class CategorySuggestRequest {
    private String recipientIdentifier;
    private String note;
}
