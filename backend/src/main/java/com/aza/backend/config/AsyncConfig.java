package com.aza.backend.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.aop.interceptor.AsyncUncaughtExceptionHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.AsyncConfigurer;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;

/**
 * Bounded async executor for tasks that should be processed asynchronously.
 *
 * Callers of @Async methods on this executor will receive a RejectedExecutionException
 * when the queue is full, which the caller should translate to a 503 Service Unavailable.
 * This creates natural backpressure — expensive work is queued up to a point, then
 * refused rather than accepted and stalled.
 *
 * Use @Async("taskExecutor") on methods in: ContactService (sync),
 * ChatService (media processing), NotificationService (fan-out sends).
 */
@Configuration
@EnableAsync
@Slf4j
public class AsyncConfig implements AsyncConfigurer {

    @Bean(name = "taskExecutor")
    public ThreadPoolTaskExecutor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(16);
        executor.setQueueCapacity(100);   // refuse beyond this — backpressure
        executor.setThreadNamePrefix("aza-async-");
        executor.setKeepAliveSeconds(60);
        // AbortPolicy: throw RejectedExecutionException back to caller → 503
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.AbortPolicy());
        executor.initialize();
        return executor;
    }

    @Override
    public Executor getAsyncExecutor() {
        return taskExecutor();
    }

    @Override
    public AsyncUncaughtExceptionHandler getAsyncUncaughtExceptionHandler() {
        return (ex, method, params) ->
                log.error("Uncaught async exception in {}: {}", method.getName(), ex.getMessage(), ex);
    }
}
