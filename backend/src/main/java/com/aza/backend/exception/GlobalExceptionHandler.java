package com.aza.backend.exception;

import com.aza.backend.dto.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

@ControllerAdvice
public class GlobalExceptionHandler {

    /**
     * Handles validation errors (@NotBlank, @Email, @Size, etc.)
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidationError(
            MethodArgumentNotValidException ex) {

        String field = ex.getBindingResult().getFieldErrors().get(0).getField();
        String message = ex.getBindingResult().getFieldErrors().get(0).getDefaultMessage();

        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error("VALIDATION_ERROR", message, field));
    }

    /**
     * Handles RuntimeExceptions thrown from services
     * (e.g. "Email already registered", "Invalid credentials")
     */
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ApiResponse<Void>> handleRuntimeException(RuntimeException ex) {
        // Determine the right HTTP status based on the message
        HttpStatus status = HttpStatus.BAD_REQUEST;
        String code = "BAD_REQUEST";

        if (ex.getMessage().contains("Invalid credentials")) {
            status = HttpStatus.UNAUTHORIZED;
            code = "INVALID_CREDENTIALS";
        } else if (ex.getMessage().contains("already registered")) {
            status = HttpStatus.CONFLICT;
            code = "DUPLICATE";
        } else if (ex.getMessage().contains("not found")) {
            status = HttpStatus.NOT_FOUND;
            code = "NOT_FOUND";
        }

        return ResponseEntity
                .status(status)
                .body(ApiResponse.error(code, ex.getMessage()));
    }

    /**
     * Catch-all for unexpected errors
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGenericException(Exception ex) {
        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("INTERNAL_ERROR", "An unexpected error occurred"));
    }
}
