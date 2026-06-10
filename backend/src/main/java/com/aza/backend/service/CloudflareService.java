package com.aza.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Syncs the admin-managed blocked-countries list to a Cloudflare WAF custom rule.
 *
 * When configured, blocked requests are dropped at the Cloudflare edge before
 * reaching the origin server. The app-layer check in RateLimitFilter acts as a
 * fallback for environments not behind Cloudflare.
 *
 * Required env vars:
 *   CLOUDFLARE_API_TOKEN  — API token with "Zone:Firewall Services:Edit" permission
 *   CLOUDFLARE_ZONE_ID    — Zone ID from the Cloudflare dashboard (Overview tab)
 *
 * On first use, a WAF custom rule named "AZA Geo Block" is created automatically
 * in the zone's http_request_firewall_custom ruleset. Subsequent calls update it.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CloudflareService {

    private final ObjectMapper objectMapper;

    @Value("${cloudflare.api-token:}")
    private String apiToken;

    @Value("${cloudflare.zone-id:}")
    private String zoneId;

    private static final String CF_BASE = "https://api.cloudflare.com/client/v4";
    private static final String RULE_DESCRIPTION = "AZA Geo Block";

    private static final HttpClient HTTP = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    /**
     * Push the current blocked-country list to Cloudflare as a WAF block rule.
     * No-ops silently if credentials are not configured.
     */
    public void syncGeoBlockRule(List<String> countryCodes) {
        if (apiToken.isBlank() || zoneId.isBlank()) {
            log.debug("Cloudflare credentials not configured — skipping WAF sync");
            return;
        }
        try {
            doSync(countryCodes);
        } catch (Exception e) {
            log.error("Cloudflare WAF sync failed — app-layer geo-block is still active: {}", e.getMessage());
        }
    }

    // ── internals ─────────────────────────────────────────────────────────────

    private void doSync(List<String> codes) throws Exception {
        // 1. Fetch (or create) the zone's custom WAF ruleset
        String rulesetId = getOrCreateRuleset();

        // 2. Get existing rules in the ruleset
        JsonNode ruleset = getRuleset(rulesetId);
        ArrayNode rules = (ArrayNode) ruleset.path("result").path("rules");

        // 3. Find the existing AZA Geo Block rule, if any
        String existingRuleId = null;
        for (JsonNode rule : rules) {
            if (RULE_DESCRIPTION.equals(rule.path("description").asText())) {
                existingRuleId = rule.path("id").asText();
                break;
            }
        }

        if (codes.isEmpty()) {
            // No countries to block — delete the rule if it exists
            if (existingRuleId != null) {
                deleteRule(rulesetId, existingRuleId);
                log.info("Cloudflare: deleted geo-block rule (no countries configured)");
            }
            return;
        }

        // 4. Build WAF expression: (ip.geoip.country in {"KP" "IR" ...})
        String expression = "(ip.geoip.country in {" +
                codes.stream().map(c -> "\"" + c + "\"").collect(Collectors.joining(" ")) +
                "})";

        if (existingRuleId != null) {
            updateRule(rulesetId, existingRuleId, expression);
            log.info("Cloudflare: updated geo-block rule — {} countries blocked", codes.size());
        } else {
            createRule(rulesetId, expression);
            log.info("Cloudflare: created geo-block rule — {} countries blocked", codes.size());
        }
    }

    private String getOrCreateRuleset() throws Exception {
        String url = CF_BASE + "/zones/" + zoneId + "/rulesets/phases/http_request_firewall_custom/entrypoint";
        HttpRequest req = bearerRequest(url).GET().build();
        HttpResponse<String> res = HTTP.send(req, HttpResponse.BodyHandlers.ofString());

        if (res.statusCode() == 200) {
            return objectMapper.readTree(res.body()).path("result").path("id").asText();
        }

        // 404 = no custom ruleset yet — create an empty one
        if (res.statusCode() == 404) {
            return createEmptyRuleset();
        }

        throw new RuntimeException("Failed to fetch Cloudflare ruleset: HTTP " + res.statusCode() + " — " + res.body());
    }

    private String createEmptyRuleset() throws Exception {
        String url = CF_BASE + "/zones/" + zoneId + "/rulesets";
        ObjectNode body = objectMapper.createObjectNode();
        body.put("name", "Zone Custom Rules");
        body.put("kind", "zone");
        body.put("phase", "http_request_firewall_custom");
        body.putArray("rules");

        HttpRequest req = bearerRequest(url)
                .POST(HttpRequest.BodyPublishers.ofString(body.toString()))
                .build();
        HttpResponse<String> res = HTTP.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() != 200 && res.statusCode() != 201) {
            throw new RuntimeException("Failed to create Cloudflare ruleset: " + res.body());
        }
        return objectMapper.readTree(res.body()).path("result").path("id").asText();
    }

    private JsonNode getRuleset(String rulesetId) throws Exception {
        String url = CF_BASE + "/zones/" + zoneId + "/rulesets/" + rulesetId;
        HttpRequest req = bearerRequest(url).GET().build();
        HttpResponse<String> res = HTTP.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() != 200) {
            throw new RuntimeException("Failed to fetch Cloudflare ruleset rules: " + res.body());
        }
        return objectMapper.readTree(res.body());
    }

    private void createRule(String rulesetId, String expression) throws Exception {
        String url = CF_BASE + "/zones/" + zoneId + "/rulesets/" + rulesetId + "/rules";
        ObjectNode body = buildRuleBody(expression);
        HttpRequest req = bearerRequest(url)
                .POST(HttpRequest.BodyPublishers.ofString(body.toString()))
                .build();
        HttpResponse<String> res = HTTP.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() != 200 && res.statusCode() != 201) {
            throw new RuntimeException("Failed to create Cloudflare rule: " + res.body());
        }
    }

    private void updateRule(String rulesetId, String ruleId, String expression) throws Exception {
        String url = CF_BASE + "/zones/" + zoneId + "/rulesets/" + rulesetId + "/rules/" + ruleId;
        ObjectNode body = buildRuleBody(expression);
        body.put("id", ruleId);
        HttpRequest req = bearerRequest(url)
                .method("PATCH", HttpRequest.BodyPublishers.ofString(body.toString()))
                .build();
        HttpResponse<String> res = HTTP.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() != 200) {
            throw new RuntimeException("Failed to update Cloudflare rule: " + res.body());
        }
    }

    private void deleteRule(String rulesetId, String ruleId) throws Exception {
        String url = CF_BASE + "/zones/" + zoneId + "/rulesets/" + rulesetId + "/rules/" + ruleId;
        HttpRequest req = bearerRequest(url).DELETE().build();
        HttpResponse<String> res = HTTP.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() != 200) {
            throw new RuntimeException("Failed to delete Cloudflare rule: " + res.body());
        }
    }

    private ObjectNode buildRuleBody(String expression) {
        ObjectNode body = objectMapper.createObjectNode();
        body.put("action", "block");
        body.put("expression", expression);
        body.put("description", RULE_DESCRIPTION);
        body.put("enabled", true);
        // Custom block response — returns GEO_RESTRICTED JSON so mobile app can handle it
        ObjectNode actionParams = body.putObject("action_parameters");
        ObjectNode response = actionParams.putObject("response");
        response.put("status_code", 403);
        response.put("content_type", "application/json");
        response.put("content", "{\"success\":false,\"error\":\"GEO_RESTRICTED\",\"message\":\"AZA is not available in your region.\"}");
        return body;
    }

    private HttpRequest.Builder bearerRequest(String url) {
        return HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Authorization", "Bearer " + apiToken)
                .header("Content-Type", "application/json");
    }
}
