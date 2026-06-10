package com.aza.backend.dto.oauth;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class OAuthUserInfoResponse {
    private String sub;            // AZA user UUID — always present
    private String name;           // identity scope
    private String username;       // identity scope
    @JsonProperty("picture")
    private String profileImage;   // identity scope
    private String email;          // email scope
    private String phone;          // phone scope
    @JsonProperty("wallet_balance")
    private String walletBalance;  // wallet:read scope
    @JsonProperty("wallet_currency")
    private String walletCurrency; // wallet:read scope
}
