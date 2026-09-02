package com.aza.backend.util;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import javax.naming.Context;
import javax.naming.NameNotFoundException;
import javax.naming.NamingException;
import javax.naming.directory.Attribute;
import javax.naming.directory.DirContext;
import javax.naming.directory.InitialDirContext;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Hashtable;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Cheap, no-send checks on an email address: does it parse, is the domain a known
 * throwaway, does the domain actually accept mail, and does it look like a typo of
 * a common provider.
 *
 * None of this proves the person owns the address — only a code sent to it does that.
 * What it does buy is catching the two failures that a verification code can't:
 * an address that will never deliver (so the code goes nowhere and the user is stuck
 * mid-signup), and a domain we don't want accounts on at all.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class EmailValidationService {

    private final StringRedisTemplate redisTemplate;

    public enum Reason {
        INVALID_FORMAT,
        DISPOSABLE_DOMAIN,
        UNRESOLVABLE_DOMAIN
    }

    /**
     * @param valid      address parses, isn't disposable, and its domain accepts mail
     * @param reason     why it isn't valid, null when it is
     * @param suggestion full corrected address when the domain looks like a typo, else null.
     *                   Advisory only — a suggestion never makes an address invalid.
     */
    public record Result(boolean valid, Reason reason, String suggestion) {
        static Result ok(String suggestion) { return new Result(true, null, suggestion); }
        static Result fail(Reason reason, String suggestion) { return new Result(false, reason, suggestion); }
    }

    // Deliberately stricter than the RFC: requires a dotted TLD of 2+ letters, which
    // every address a consumer can actually receive mail on has.
    private static final Pattern EMAIL_PATTERN =
            Pattern.compile("^[A-Za-z0-9+_.-]+@[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)*\\.[A-Za-z]{2,}$");

    private static final String MX_CACHE_PREFIX = "email:domain:mx:";
    // Resolvable domains are cached long — MX records rarely change and this is the hot
    // path for every keystroke pause on the signup screen. Failures expire quickly so a
    // domain that was mid-DNS-change isn't blocked for a week.
    private static final Duration MX_OK_TTL = Duration.ofDays(7);
    private static final Duration MX_FAIL_TTL = Duration.ofHours(1);

    private static final int DNS_TIMEOUT_MS = 2000;
    private static final int DNS_RETRIES = 1;

    private static final int MAX_TYPO_DISTANCE = 2;

    // Providers that account for nearly every consumer address we see, and so nearly
    // every typo'd one too.
    private static final List<String> COMMON_DOMAINS = List.of(
            "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "ymail.com",
            "hotmail.com", "hotmail.co.uk", "outlook.com", "live.com", "msn.com",
            "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com",
            "zoho.com", "gmx.com", "mail.com", "yandex.com"
    );

    private Set<String> disposableDomains = Set.of();

    @PostConstruct
    void loadDisposableDomains() {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                new ClassPathResource("email/disposable-domains.txt").getInputStream(),
                StandardCharsets.UTF_8))) {
            disposableDomains = reader.lines()
                    .map(line -> line.trim().toLowerCase())
                    .filter(line -> !line.isEmpty() && !line.startsWith("#"))
                    .collect(Collectors.toUnmodifiableSet());
            log.info("Loaded {} disposable email domains", disposableDomains.size());
        } catch (Exception e) {
            // Never fail startup over the blocklist — the OTP step is the real gate.
            log.error("Failed to load disposable email domain list; disposable filtering is off", e);
        }
    }

    public Result validate(String email) {
        if (email == null || email.isBlank()) {
            return Result.fail(Reason.INVALID_FORMAT, null);
        }
        String normalized = email.trim().toLowerCase();
        if (!EMAIL_PATTERN.matcher(normalized).matches()) {
            return Result.fail(Reason.INVALID_FORMAT, null);
        }

        String domain = normalized.substring(normalized.indexOf('@') + 1);
        if (disposableDomains.contains(domain)) {
            return Result.fail(Reason.DISPOSABLE_DOMAIN, null);
        }

        String suggestion = suggestCorrection(normalized, domain);
        return domainAcceptsMail(domain)
                ? Result.ok(suggestion)
                : Result.fail(Reason.UNRESOLVABLE_DOMAIN, suggestion);
    }

    // ==================== DOMAIN RESOLUTION ====================

    private boolean domainAcceptsMail(String domain) {
        String key = MX_CACHE_PREFIX + domain;
        try {
            String cached = redisTemplate.opsForValue().get(key);
            if (cached != null) return "1".equals(cached);
        } catch (DataAccessException e) {
            // Redis down — do the lookup uncached rather than blocking signups.
            return lookupDomain(domain) != Resolution.NXDOMAIN;
        }

        Resolution resolution = lookupDomain(domain);
        if (resolution != Resolution.UNKNOWN) {
            try {
                boolean ok = resolution == Resolution.ACCEPTS_MAIL;
                redisTemplate.opsForValue().set(key, ok ? "1" : "0", ok ? MX_OK_TTL : MX_FAIL_TTL);
            } catch (DataAccessException ignored) {
                // Caching is an optimisation, not a requirement.
            }
        }
        return resolution != Resolution.NXDOMAIN;
    }

    private enum Resolution {
        ACCEPTS_MAIL,
        NXDOMAIN,
        /** DNS itself failed — treated as acceptable and never cached, so our outage isn't the user's. */
        UNKNOWN
    }

    private Resolution lookupDomain(String domain) {
        Hashtable<String, String> env = new Hashtable<>();
        env.put(Context.INITIAL_CONTEXT_FACTORY, "com.sun.jndi.dns.DnsContextFactory");
        env.put("com.sun.jndi.dns.timeout.initial", String.valueOf(DNS_TIMEOUT_MS));
        env.put("com.sun.jndi.dns.timeout.retries", String.valueOf(DNS_RETRIES));

        DirContext ctx = null;
        try {
            ctx = new InitialDirContext(env);
            // One record type per query, deliberately. Asking the JNDI DNS provider for
            // several at once races the responses against each other and intermittently
            // returns an empty set for a domain that plainly has the records — which here
            // would mean turning a real user away mid-signup. Single-id lookups are stable,
            // and MX alone answers it for nearly every domain we see.
            if (hasRecords(ctx, domain, "MX")) return Resolution.ACCEPTS_MAIL;
            // No MX but an A/AAAA record still accepts mail at that host (RFC 5321 implicit
            // MX), so a missing MX alone isn't grounds to reject the address.
            if (hasRecords(ctx, domain, "A")) return Resolution.ACCEPTS_MAIL;
            if (hasRecords(ctx, domain, "AAAA")) return Resolution.ACCEPTS_MAIL;
            return Resolution.NXDOMAIN;
        } catch (NameNotFoundException e) {
            return Resolution.NXDOMAIN;
        } catch (NamingException e) {
            log.debug("DNS lookup failed for {}: {}", domain, e.getMessage());
            return Resolution.UNKNOWN;
        } finally {
            if (ctx != null) {
                try { ctx.close(); } catch (NamingException ignored) { }
            }
        }
    }

    private boolean hasRecords(DirContext ctx, String domain, String type) throws NamingException {
        Attribute attr = ctx.getAttributes(domain, new String[]{type}).get(type);
        return attr != null && attr.size() > 0;
    }

    // ==================== TYPO SUGGESTION ====================

    private String suggestCorrection(String email, String domain) {
        if (COMMON_DOMAINS.contains(domain)) return null;

        String best = null;
        int bestDistance = Integer.MAX_VALUE;
        for (String candidate : COMMON_DOMAINS) {
            int distance = damerauLevenshtein(domain, candidate, MAX_TYPO_DISTANCE);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = candidate;
            }
        }

        if (best == null || bestDistance > MAX_TYPO_DISTANCE) return null;
        // Note that a resolving domain is no reason to stay quiet: typosquatters register
        // gmial.com and gnail.co precisely because people mistype them, so the addresses
        // most worth flagging are exactly the ones that pass the DNS check. The hint is
        // advisory — the user still has to tap it — so a wrong guess costs little.
        return email.substring(0, email.indexOf('@') + 1) + best;
    }

    /**
     * Optimal string alignment distance — Levenshtein plus adjacent transpositions,
     * because "gmial"/"yahooo" style slips are transpositions and plain Levenshtein
     * charges them double. Gives up once every cell exceeds {@code max}.
     */
    static int damerauLevenshtein(String a, String b, int max) {
        if (Math.abs(a.length() - b.length()) > max) return max + 1;

        int[] prevPrev = new int[b.length() + 1];
        int[] prev = new int[b.length() + 1];
        int[] current = new int[b.length() + 1];

        for (int j = 0; j <= b.length(); j++) prev[j] = j;

        for (int i = 1; i <= a.length(); i++) {
            current[0] = i;
            int rowMin = current[0];
            for (int j = 1; j <= b.length(); j++) {
                int cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                int value = Math.min(
                        Math.min(current[j - 1] + 1, prev[j] + 1),
                        prev[j - 1] + cost);
                if (i > 1 && j > 1
                        && a.charAt(i - 1) == b.charAt(j - 2)
                        && a.charAt(i - 2) == b.charAt(j - 1)) {
                    value = Math.min(value, prevPrev[j - 2] + 1);
                }
                current[j] = value;
                rowMin = Math.min(rowMin, value);
            }
            if (rowMin > max) return max + 1;

            int[] rotated = prevPrev;
            prevPrev = prev;
            prev = current;
            current = rotated;
        }
        return prev[b.length()];
    }
}
