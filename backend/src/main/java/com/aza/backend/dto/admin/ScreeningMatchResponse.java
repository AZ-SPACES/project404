package com.aza.backend.dto.admin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class ScreeningMatchResponse {
    private String id;
    private String userId;
    private String userName;
    private String userEmail;
    private String listName;
    private String listEntryName;
    private String entryType;
    private int matchScore;
    private String status;
    private String notes;
    private String createdAt;
    private String reviewedAt;
}
