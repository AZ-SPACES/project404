package com.aza.backend.exception;

import org.springframework.http.HttpStatus;

/**
 * Use this for business-logic errors with a safe, user-facing message.
 * Prefer this over RuntimeException for all expected failure paths.
 */
public class AppException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    public AppException(String code, String message, HttpStatus status) {
        super(message);
        this.code = code;
        this.status = status;
    }

    public HttpStatus getStatus() { return status; }
    public String getCode() { return code; }
}
