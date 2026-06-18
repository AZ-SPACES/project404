package com.aza.backend.config;

import com.aza.backend.security.AdminIpAllowlistFilter;
import com.aza.backend.security.AdminStepUpFilter;
import com.aza.backend.security.JwtAuthenticationFilter;
import com.aza.backend.security.filter.MerchantApiKeyFilter;
import com.aza.backend.security.filter.RateLimitFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.annotation.web.configurers.HeadersConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;

import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

import static org.springframework.security.config.Customizer.withDefaults;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final RateLimitFilter rateLimitFilter;
    private final MerchantApiKeyFilter merchantApiKeyFilter;
    private final AdminStepUpFilter adminStepUpFilter;
    private final AdminIpAllowlistFilter adminIpAllowlistFilter;

    @Value("${app.allowed-origins:http://localhost:3000}")
    private String allowedOrigins;

    @Value("${springdoc.swagger-ui.enabled:false}")
    private boolean swaggerUiEnabled;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .headers(headers -> headers
                        .contentTypeOptions(withDefaults())
                        .frameOptions(HeadersConfigurer.FrameOptionsConfig::deny)
                        .httpStrictTransportSecurity(hsts -> hsts
                                .includeSubDomains(true)
                                .maxAgeInSeconds(31536000))
                        .contentSecurityPolicy(csp -> csp
                                .policyDirectives("default-src 'self'; frame-ancestors 'none'"))
                        .referrerPolicy(referrer -> referrer
                                .policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
                )
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> {
                    // App-push 2FA approval must be authenticated — the responding device already has a JWT.
                    // QR login authorize must be authenticated — the mobile user proves their identity.
                    // These rules must precede the /api/v1/auth/** permitAll wildcard.
                    auth.requestMatchers(HttpMethod.POST, "/api/v1/auth/2fa/app/respond").authenticated();
                    auth.requestMatchers(HttpMethod.POST, "/api/v1/auth/qr-login/authorize").authenticated();
                    // Recovery contact management — requires full auth (these are not pre-auth flows)
                    auth.requestMatchers(
                            "/api/v1/auth/recovery-contact",
                            "/api/v1/auth/recovery-contact/invite",
                            "/api/v1/auth/recovery-contact/pending-invitations",
                            "/api/v1/auth/recovery-contact/generate",
                            "/api/v1/auth/recovery-contact/*/accept",
                            "/api/v1/auth/recovery-contact/*/decline",
                            "/api/v1/auth/recovery-contact/*/as-contact"
                    ).authenticated();
                    auth.requestMatchers(HttpMethod.DELETE, "/api/v1/auth/recovery-contact/*").authenticated();
                    auth.requestMatchers(
                            "/api/v1/auth/**",
                            "/api/v1/waitlist",
                            "/api/v1/users/check-handle",
                            "/api/v1/users/check-email",
                            "/api/v1/users/check-phone",
                            "/api/v1/users/suggest-handles",
                            "/api/v1/security/verify-challenge",
                            "/ws/**",
                            "/ws/chat/**",
                            "/actuator/**"
                    ).permitAll();
                    // OAuth 2.0 public endpoints — authenticated via client_secret or Bearer token
                    auth.requestMatchers(
                            "/oauth/token",
                            "/oauth/revoke",
                            "/oauth/userinfo",
                            "/oauth/authorize",
                            "/oauth/approve",
                            "/oauth/pending/*",
                            "/oauth/qr/initiate",
                            "/oauth/qr/status/*",
                            "/oauth/qr/complete",
                            "/oauth/clients/*",
                            "/oauth/payments/**"
                    ).permitAll();
                    // Checkout GET is public; confirm and cancel require authenticated JWT
                    auth.requestMatchers(HttpMethod.GET, "/api/v1/checkout/*").permitAll();
                    // Discount validation is public — no auth needed
                    auth.requestMatchers(HttpMethod.POST, "/api/v1/checkout/discount/validate").permitAll();
                    // Promo code validation is public — redeem requires auth (handled by catch-all)
                    auth.requestMatchers(HttpMethod.GET, "/api/v1/promos/validate").permitAll();
                    // Team invite acceptance is public (email-based verification)
                    auth.requestMatchers(HttpMethod.POST, "/api/v1/merchant/team/accept/*").permitAll();
                    // Public merchant profile by handle — for customer payment pages
                    auth.requestMatchers(HttpMethod.GET, "/api/v1/merchant/public/*").permitAll();
                    // Statement verification — publicly accessible so employers/banks can verify
                    auth.requestMatchers(HttpMethod.GET, "/api/v1/public/statements/verify").permitAll();
                    auth.requestMatchers(HttpMethod.GET, "/api/v1/public/statements/verify/page").permitAll();
                    // Payment-proof verification — public; the QR carries its own HMAC signature
                    auth.requestMatchers(HttpMethod.GET, "/api/v1/public/payments/verify").permitAll();
                    // Mobile KYB handoff — token-authenticated, no user session required
                    auth.requestMatchers(HttpMethod.GET, "/api/v1/public/kyb-mobile/*").permitAll();
                    auth.requestMatchers(HttpMethod.GET, "/api/v1/public/kyb-mobile/*/status").permitAll();
                    auth.requestMatchers(HttpMethod.POST, "/api/v1/public/kyb-mobile/*/upload").permitAll();
                    // OpenAPI JSON is public — it powers the curated developer explorer on aza-web.
                    auth.requestMatchers("/v3/api-docs/**").permitAll();
                    if (swaggerUiEnabled) {
                        // Raw Swagger UI is dev-only (SWAGGER_UI_ENABLED=true); off in production.
                        auth.requestMatchers(
                                "/swagger-ui/**",
                                "/swagger-ui.html"
                        ).permitAll();
                    }
                    // Coarse gate: any staff role may reach the admin API surface.
                    // Fine-grained per-area access is enforced by @PreAuthorize on each controller.
                    auth.requestMatchers("/api/v1/admin/**")
                            .hasAnyRole("ADMIN", "SUPPORT", "COMPLIANCE", "FINANCE");
                    auth.anyRequest().authenticated();
            })
            .exceptionHandling(ex -> ex
                    .authenticationEntryPoint((request, response, authException) ->
                            response.sendError(401, "Unauthorized"))
                    .accessDeniedHandler((request, response, accessDeniedException) ->
                            response.sendError(403, "Forbidden")))
            // Network gate first: admin paths can be pinned to office IPs (no-op when unset)
            .addFilterBefore(adminIpAllowlistFilter, UsernamePasswordAuthenticationFilter.class)
            // JWT runs first; API key filter then skips if a valid JWT already authenticated the request
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterAfter(merchantApiKeyFilter, JwtAuthenticationFilter.class)
            // RateLimitFilter runs AFTER JWT auth so it can read SecurityContext for user-level limits
            .addFilterAfter(rateLimitFilter, JwtAuthenticationFilter.class)
            // Admin console requires fresh 2FA elevation on top of a valid JWT
            .addFilterAfter(adminStepUpFilter, JwtAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(Arrays.asList(allowedOrigins.split(",")));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        config.setAllowedHeaders(List.of(
                "Authorization", "Content-Type", "X-Requested-With",
                "X-Device-ID", "X-Platform", "X-Bypass-Token", "X-Api-Key",
                "X-Aza-Client"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }


    @Bean
    public AuthenticationManager authenticationManager(
            AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
}
