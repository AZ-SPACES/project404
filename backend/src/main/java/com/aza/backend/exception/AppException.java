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

    public AppException(String message) {
        super(message);
        this.code = "ERROR";
        this.status = HttpStatus.BAD_REQUEST;
    }

    public AppException(String message, Throwable cause) {
        super(message, cause);
        this.code = "INTERNAL_ERROR";
        this.status = HttpStatus.INTERNAL_SERVER_ERROR;
    }

    public HttpStatus getStatus() { return status; }
    public String getCode() { return code; }
}
