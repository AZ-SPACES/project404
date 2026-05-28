package com.aza.backend.exception;

import com.aza.backend.dto.ApiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

import java.util.List;

@ControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidationError(
            MethodArgumentNotValidException ex) {
        List<FieldError> fieldErrors = ex.getBindingResult().getFieldErrors();
        if (!fieldErrors.isEmpty()) {
            String field = fieldErrors.get(0).getField();
            String message = fieldErrors.get(0).getDefaultMessage();
            return ResponseEntity
                    .status(HttpStatus.BAD_REQUEST)
                    .body(ApiResponse.error("VALIDATION_ERROR", message, field));
        }
        String message = ex.getBindingResult().getAllErrors().isEmpty()
                ? "Validation failed"
                : ex.getBindingResult().getAllErrors().get(0).getDefaultMessage();
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error("VALIDATION_ERROR", message));
    }

    /**
     * AppException carries a pre-approved user-facing message and explicit status code.
     * All new service code should throw this instead of RuntimeException.
     */
    @ExceptionHandler(AppException.class)
    public ResponseEntity<ApiResponse<Void>> handleAppException(AppException ex) {
        return ResponseEntity
                .status(ex.getStatus())
                .body(ApiResponse.error(ex.getCode(), ex.getMessage()));
    }

    /**
     * RuntimeException from legacy service code.
     * The message is passed through because existing services rely on it for user feedback.
     * Migrate callers to AppException to gain explicit status control.

     */
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ApiResponse<Void>> handleRuntimeException(RuntimeException ex) {
        String message = ex.getMessage();
        if (message == null) {
            log.error("Unexpected RuntimeException with null message", ex);
            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("INTERNAL_ERROR", "An unexpected error occurred"));
        }

        HttpStatus status = HttpStatus.BAD_REQUEST;
        String code = "BAD_REQUEST";

        if (message.contains("Invalid credentials") || message.contains("not active")) {
            status = HttpStatus.UNAUTHORIZED;
            code = "INVALID_CREDENTIALS";
        } else if (message.contains("already registered") || message.contains("already exists")) {
            status = HttpStatus.CONFLICT;
            code = "DUPLICATE";
        } else if (message.contains("not found")) {
            status = HttpStatus.NOT_FOUND;
            code = "NOT_FOUND";
        } else if (message.contains("Not authorized") || message.contains("not authorized")) {
            status = HttpStatus.FORBIDDEN;
            code = "FORBIDDEN";
        }

        return ResponseEntity
                .status(status)
                .body(ApiResponse.error(code, message));
    }

    @ExceptionHandler(RateLimitExceededException.class)
    public ResponseEntity<ApiResponse<Void>> handleRateLimitException(RateLimitExceededException ex) {
        return ResponseEntity
                .status(HttpStatus.TOO_MANY_REQUESTS)
                .header("Retry-After", String.valueOf(ex.getRetryAfterSeconds()))
                .header("X-Challenge-Available", "true")
                .body(ApiResponse.error("RATE_LIMIT_EXCEEDED", ex.getMessage()));
    }

    @ExceptionHandler(SuspiciousActivityException.class)
    public ResponseEntity<ApiResponse<Void>> handleSuspiciousActivity(SuspiciousActivityException ex) {
        return ResponseEntity
                .status(HttpStatus.TOO_MANY_REQUESTS)
                .header("Retry-After", String.valueOf(ex.getRetryAfterSeconds()))
                .header("X-Challenge-Token", ex.getChallengeToken())
                .header("X-Challenge-Available", "true")
                .body(ApiResponse.error("CHALLENGE_REQUIRED",
                        "Suspicious activity detected. Complete the CAPTCHA challenge to continue."));
    }

    @ExceptionHandler(java.util.concurrent.RejectedExecutionException.class)
    public ResponseEntity<ApiResponse<Void>> handleRejectedExecution(java.util.concurrent.RejectedExecutionException ex) {
        log.warn("Async task queue full — returning 503: {}", ex.getMessage());
        return ResponseEntity
                .status(HttpStatus.SERVICE_UNAVAILABLE)
                .header("Retry-After", "5")
                .body(ApiResponse.error("SERVICE_BUSY", "The server is busy. Please retry in a moment."));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGenericException(Exception ex) {
        log.error("Unhandled exception: {}", ex.getMessage(), ex);
        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("INTERNAL_ERROR", "An unexpected error occurred"));
    }
}
