package com.aza.backend.dto.admin;

import lombok.Data;

@Data
public class CampaignRequest {
    private String type; 
    private String subject; 
    private String message;
    private String segment; 
}
