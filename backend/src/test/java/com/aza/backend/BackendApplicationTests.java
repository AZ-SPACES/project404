package com.aza.backend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/**
 * Verifies the whole application context wires up. Runs under the test profile
 * with the Redis infrastructure beans mocked, matching the rest of the suite —
 * there is no Redis server in the test environment.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
class BackendApplicationTests {

	@MockitoBean StringRedisTemplate stringRedisTemplate;
	@MockitoBean RedisMessageListenerContainer redisMessageListenerContainer;

	@Test
	void contextLoads() {
	}

}
