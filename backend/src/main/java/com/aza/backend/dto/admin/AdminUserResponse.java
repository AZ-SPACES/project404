package com.aza.backend.dto.admin;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
public class AdminUserResponse {
    private String id;
    private String email;
    private String phone;
    private String username;
    private String firstName;
    private String lastName;
    private String profileImageUrl;
    private LocalDate dateOfBirth;
    private String nationality;
    private String city;
    private String homeAddress;
    private String employmentStatus;
    private String accountStatus;
    private String kycStatus;
    private String role;
    private Boolean twoFactorEnabled;
    private Boolean biometricsEnabled;
    private BigDecimal walletBalance;
    private String walletCurrency;
    private LocalDateTime createdAt;
    private LocalDateTime lastLoginAt;
    private BigDecimal customDailyLimitGhs;
    private BigDecimal customSingleTransactionLimitGhs;
}
