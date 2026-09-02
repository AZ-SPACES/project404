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
     * DataIntegrityViolationException from JPA/Hibernate.
     * Must be caught BEFORE RuntimeException so the raw constraint message never reaches the client.
     */
    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleDataIntegrityViolation(
            org.springframework.dao.DataIntegrityViolationException ex) {
        log.warn("Data integrity violation: {}", ex.getMessage());

        // Signup checks existsByEmail/existsByPhoneNumber before inserting, but two
        // requests racing on the same address both pass that check and one loses at the
        // unique index. It's the same "already taken" condition the client already knows
        // how to show, so name the field instead of returning a generic conflict the
        // signup screen can only render as an unexplained failure.
        // Postgres reports both a constraint name ("users_email_key") and a detail line
        // ("Key (email)=(…) already exists"); match either so this survives a constraint
        // being renamed.
        String detail = rootMessage(ex).toLowerCase();
        // Email has two unique indexes: users_email_key on the raw column and
        // users_email_lower_key on lower(email). Either can be the one that fires.
        if (violates(detail, "users_email_key", "users_email_lower_key", "key (email)", "key (lower(email")) {
            return conflict("EMAIL_ALREADY_EXISTS", "This email address is already in use");
        }
        if (violates(detail, "users_phone_number_key", "key (phone_number)")) {
            return conflict("PHONE_ALREADY_EXISTS", "This phone number is already in use");
        }
        if (violates(detail, "users_username_key", "key (username)")) {
            return conflict("HANDLE_ALREADY_EXISTS", "This handle is already in use");
        }
        return conflict("CONFLICT", "This action conflicts with existing data");
    }

    private boolean violates(String detail, String... markers) {
        for (String marker : markers) {
            if (detail.contains(marker)) return true;
        }
        return false;
    }

    private ResponseEntity<ApiResponse<Void>> conflict(String code, String message) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiResponse.error(code, message));
    }

    /** The constraint name lives on the driver's exception, not the Spring wrapper's message. */
    private String rootMessage(Throwable ex) {
        StringBuilder sb = new StringBuilder();
        for (Throwable t = ex; t != null && sb.length() < 2000; t = t.getCause()) {
            if (t.getMessage() != null) sb.append(t.getMessage()).append(' ');
            if (t.getCause() == t) break;
        }
        return sb.toString();
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

    @ExceptionHandler(org.springframework.web.HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ApiResponse<Void>> handleUnsupportedMediaType(
            org.springframework.web.HttpMediaTypeNotSupportedException ex) {
        log.warn("Unsupported media type: {}", ex.getMessage());
        return ResponseEntity
                .status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
                .body(ApiResponse.error("UNSUPPORTED_MEDIA_TYPE",
                        "Content-Type not supported for this endpoint."));
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
