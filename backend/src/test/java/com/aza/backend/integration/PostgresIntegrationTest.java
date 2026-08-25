package com.aza.backend.integration;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Base class for tests that need a real PostgreSQL rather than H2.
 *
 * <p>The container is {@code static}, so one database is started for the whole suite and
 * shared by every subclass — starting a fresh PostgreSQL per test class would dominate
 * the runtime for no benefit.
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

    @Container
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
     * startup dependency, and this keeps the boot path honest about what the application
     * actually requires. {@code @ServiceConnection} supplies the host and port, taking
     * precedence over any {@code spring.data.redis.*} property.
     */
    @Container
    @ServiceConnection(name = "redis")
    static final GenericContainer<?> REDIS =
            new GenericContainer<>("redis:7-alpine").withExposedPorts(6379).withReuse(true);
}
