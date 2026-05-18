package com.aza.backend.config;

import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * Provides named CircuitBreaker beans for critical service tiers.
 *
 * Inject the appropriate breaker into a service and wrap the call:
 *
 *   CircuitBreaker.decorateSupplier(transferBreaker, () -> doTransfer(...))
 *       .get();  // throws CallNotPermittedException when open
 *
 * Open → Half-Open transition happens automatically after the configured wait duration.
 */
@Configuration
public class CircuitBreakerConfig {

    @Bean
    public CircuitBreakerRegistry circuitBreakerRegistry() {
        io.github.resilience4j.circuitbreaker.CircuitBreakerConfig defaultConfig =
                io.github.resilience4j.circuitbreaker.CircuitBreakerConfig.custom()
                        .slidingWindowType(io.github.resilience4j.circuitbreaker.CircuitBreakerConfig.SlidingWindowType.COUNT_BASED)
                        .slidingWindowSize(20)
                        .failureRateThreshold(50f)          // open when ≥50% of calls fail
                        .slowCallRateThreshold(80f)          // also open on slow calls
                        .slowCallDurationThreshold(Duration.ofSeconds(5))
                        .waitDurationInOpenState(Duration.ofSeconds(30))
                        .permittedNumberOfCallsInHalfOpenState(5)
                        .minimumNumberOfCalls(10)
                        .build();

        return CircuitBreakerRegistry.of(defaultConfig);
    }

    /** Used by TransferService — payments and wallet operations. */
    @Bean
    public CircuitBreaker transferCircuitBreaker(CircuitBreakerRegistry registry) {
        io.github.resilience4j.circuitbreaker.CircuitBreakerConfig cfg =
                io.github.resilience4j.circuitbreaker.CircuitBreakerConfig.from(
                        registry.getDefaultConfig())
                        .failureRateThreshold(30f)          // stricter for financial ops
                        .waitDurationInOpenState(Duration.ofMinutes(1))
                        .build();
        return registry.circuitBreaker("transfers", cfg);
    }

    /** Used by AuthService — protects the DB during auth storms. */
    @Bean
    public CircuitBreaker authCircuitBreaker(CircuitBreakerRegistry registry) {
        return registry.circuitBreaker("auth");
    }

    /** Used by notification/external API calls (FCM, SMS, email). */
    @Bean
    public CircuitBreaker notificationCircuitBreaker(CircuitBreakerRegistry registry) {
        io.github.resilience4j.circuitbreaker.CircuitBreakerConfig cfg =
                io.github.resilience4j.circuitbreaker.CircuitBreakerConfig.from(
                        registry.getDefaultConfig())
                        .waitDurationInOpenState(Duration.ofSeconds(15))
                        .build();
        return registry.circuitBreaker("notifications", cfg);
    }
}
