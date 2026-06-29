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
                                - **Merchant API key** — `X-Api-Key: aza_live_… | aza_test_…` for server-to-server
                                  `/api/v1/merchant/*` calls. Create keys in the merchant dashboard.
                                - **Bearer token** — `Authorization: Bearer <token>` for OAuth partner/user sessions.

                                ### Sandbox
                                Use an **`aza_test_`** key to work in the sandbox: checkout sessions are created
                                in test mode and never move real money. Complete one end-to-end with
                                `POST /api/v1/merchant/sessions/{id}/simulate`, which marks it paid and fires a
                                webhook with `livemode:false` — no customer or funds required. Switch to an
                                `aza_live_` key to go live.

                                ### Platforms & marketplaces (multi-tenant)
                                A platform that hosts many independent sellers/stores (an Amazon-style marketplace)
                                integrates as a **single AZA merchant**: one account, one wallet, one set of API keys.
                                You stay the merchant of record and settle to your tenants yourself.
                                - **Attribute each payment to a tenant/order** — set `reference` (e.g. a tenant or
                                  order id) and/or `metadata` (arbitrary JSON) when you create the checkout session.
                                  Both are echoed back on the session and in the `checkout.completed` webhook, so you
                                  can route the payment to the right tenant from the webhook alone.
                                - **Reconcile per tenant** — `GET /api/v1/merchant/sessions?reference=…` lists a single
                                  tenant's sessions, and `GET /api/v1/merchant/sessions/summary?reference=…` returns the
                                  count, gross and net totals for that reference.
                                - **Pay your tenants** out-of-band on your own schedule, net of your commission. AZA
                                  settles only to your platform account; it does not split funds to individual tenants.
                                - **Idempotency keys are unique within your account.** Namespace them per tenant/order
                                  (e.g. `tenantA:order-123`) so two tenants can never collide.
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
