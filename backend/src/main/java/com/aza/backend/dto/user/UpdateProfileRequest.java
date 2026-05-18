package com.aza.backend.dto.user;

import lombok.Data;

@Data
public class UpdateProfileRequest {

    private String firstName;
    private String lastName;
    private String email;
    private String phone;
    private String handle;
    private String pronouns;
    private String dateOfBirth;
    private String homeAddress;
    private String city;
    private String nationality;
    private String otherNationality;
    private Boolean isTaxResidentAbroad;
    private String taxCountry;
    private Boolean isUSPerson;
    private String employmentStatus;
    private String language;
    private String theme;
    private String homeBackground;
    private String hubBackground;
}
