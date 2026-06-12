package com.aza.backend.dto.admin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class DataRequestResponse {
    private String id;
    private String userId;
    private String userName;
    private String userEmail;
    private String type;
    private String status;
    private String dueDate;
    private boolean overdue;
    private String notes;
    private String createdAt;
    private String completedAt;
}
