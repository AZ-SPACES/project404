package com.aza.backend.dto;

import lombok.Data;

@Data
public class ReportHandleRequest {
    /** The handle / store code being reported (with or without a leading @). */
    private String handle;
    /** One of HandleReport.ReportReason; unknown values fall back to OTHER. */
    private String reason;
    private String details;
}
