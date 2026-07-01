package com.aza.backend.dto.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class SignupRequest {

    @NotBlank(message = "Phone number is required")
    private String phone;

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

    @NotBlank(message = "Password is required")
    @Size(min = 8, message = "Password must be at least 8 characters")
    private String password;

    @Size(min = 4, max = 4, message = "Passcode must be exactly 4 digits")
    private String passcode; // 4-digit PIN

    private String firstName;
    private String lastName;
    private String handle;
    private String pronouns;
    private String dateOfBirth;       // "YYYY-MM-DD"

    private String deviceName;
    private String deviceOs;
    private String deviceId;

    // Address fields
    private String homeAddress;
    private String city;
    private String nationality;
    private String otherNationality;
    private Boolean isTaxResidentAbroad;
    private String taxCountry;
    private Boolean isUSPerson;

    // Employment
    private String employmentStatus;  // STUDENT, FULL_TIME, etc.

    // Referral
    private String referralCode;
}
