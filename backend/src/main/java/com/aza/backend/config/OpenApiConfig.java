package com.aza.backend.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/**
 * OpenAPI metadata for the public AZA API. This is the Merchant + Partner
 * (third-party) surface — the endpoints external developers integrate against.
 * The set of documented paths is restricted via {@code springdoc.paths-to-match}
 * so internal mobile/app and admin endpoints never appear here.
 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI azaOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("AZA Merchant & Partner API")
                        .version("v1")
                        .description("""
                                The public AZA API for **merchants** and **third-party developers**. This is the
                                integration surface only — internal app, operations, and admin endpoints are not
                                exposed here.

                                ### How AZA fits together
                                - **Merchant API** (`/api/v1/merchant/*`) — server-to-server with a secret API key.
                                  Create checkout sessions and invoices, manage payouts, settlements, products,
                                  discount codes and webhooks. Manage it all in the dashboard at
                                  **[merchants.aza.systems](https://merchants.aza.systems)**.
                                - **Hosted checkout** — a checkout session returns a `checkoutUrl` on
                                  **[pay.aza.systems](https://pay.aza.systems)**. Redirect your customer there to pay;
                                  AZA handles the payment UI, 2FA and receipts, then notifies you by webhook.
                                - **Sign in with AZA** (`/oauth/*`) — OAuth 2.0 so third-party apps can authenticate
                                  AZA users and request payments on their behalf. Register an app under
                                  **Developer Clients**.

                                ### Authentication
                                - **Merchant API key** — `X-Api-Key: sk_live_… | sk_test_…` for server-to-server
                                  `/api/v1/merchant/*` calls. Create keys in the merchant dashboard.
                                - **Bearer token** — `Authorization: Bearer <token>` for OAuth partner/user sessions.

                                Use `sk_test_…` keys against test data before going live.
                                """)
                        .contact(new Contact().name("AZA Developers").url("https://aza.systems/developers")))
                .servers(List.of(
                        new Server().url("https://api.aza.systems").description("Production"),
                        new Server().url("http://localhost:8080").description("Local development")))
                .components(new Components()
                        .addSecuritySchemes("bearerAuth", new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("User or partner session token"))
                        .addSecuritySchemes("apiKey", new SecurityScheme()
                                .type(SecurityScheme.Type.APIKEY)
                                .in(SecurityScheme.In.HEADER)
                                .name("X-Api-Key")
                                .description("Merchant API key for /api/v1/merchant/* server-to-server calls")));
    }
}
