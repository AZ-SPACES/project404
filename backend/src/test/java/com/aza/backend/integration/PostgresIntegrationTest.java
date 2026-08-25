package com.aza.backend.integration;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Base class for tests that need a real PostgreSQL rather than H2.
 *
 * <p>{@code disabledWithoutDocker} is what keeps this honest on a developer laptop with
 * no daemon running: the suite skips rather than fails, so {@code mvn test} stays green
 * locally while CI — where Docker is always present — actually runs it. Skipped is not
 * passed; check the CI output, not your own, before claiming these pass.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("integration")
@Testcontainers(disabledWithoutDocker = true)
public abstract class PostgresIntegrationTest {

    /**
     * Singleton containers: started once in the static initializer below and never
     * stopped. Deliberately <em>not</em> annotated {@code @Container}.
     *
     * <p>{@code @Container} binds a container's lifecycle to the class declaring it.
     * Because this field is inherited, that means every subclass stops and restarts it on
     * a fresh random port — while Spring's test context is cached and shared across those
     * same subclasses. The second class therefore inherited a datasource still pointing at
     * the first class's dead container, and every one of its tests failed with connection
     * refused. Starting the containers once and leaving them up is Testcontainers'
     * documented singleton pattern; Ryuk removes them when the JVM exits.
     */
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:16").withReuse(true);

    /**
     * Redis is not what either subclass asserts, but the context will not start without
     * it. {@code RedisPubSubConfig} declares a {@link
     * org.springframework.data.redis.listener.RedisMessageListenerContainer}, a lifecycle
     * bean that opens a connection as the context starts. The unit-test profile gets away
     * with a fake host because every test there mocks that bean; a full
     * {@code @SpringBootTest} wires the real one, so with no Redis reachable the context
     * fails and every test in the class errors out before it runs.
     *
     * <p>A container rather than a mock: mocking a lifecycle bean would hide a genuine
     * startup dependency, and booting the context is the strongest assertion
     * {@link MigrationChainIT} makes.
     */
    @ServiceConnection(name = "redis")
    static final GenericContainer<?> REDIS =
            new GenericContainer<>("redis:7-alpine").withExposedPorts(6379).withReuse(true);

    static {
        POSTGRES.start();
        REDIS.start();
    }
}
