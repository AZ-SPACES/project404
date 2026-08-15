package com.aza.backend.service.biller;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Picks the provider Aza settles bills through.
 *
 * Until a real aggregator is wired there is none, and the fallback refuses to pay rather
 * than pretending. Adding a provider is just adding a {@link BillerProvider} bean —
 * this backs off the moment one exists.
 *
 * The conditional lives on a {@code @Bean} method rather than on the class itself
 * because that is the only place Spring evaluates it reliably: on a scanned
 * {@code @Component} it is judged against a half-built registry and the bean can vanish.
 */
@Configuration
public class BillerProviderConfig {

    @Bean
    @ConditionalOnMissingBean(BillerProvider.class)
    public BillerProvider unconfiguredBillerProvider() {
        return new UnconfiguredBillerProvider();
    }
}
