package com.aza.backend.config;

import com.aza.backend.entity.User;
import com.aza.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class AdminBootstrapRunner implements ApplicationRunner {

    private final UserRepository userRepository;

    @Value("${app.admin.bootstrap-email:}")
    private String bootstrapEmail;

    @Override
    public void run(ApplicationArguments args) {
        if (bootstrapEmail == null || bootstrapEmail.isBlank()) return;

        userRepository.findByEmail(bootstrapEmail.toLowerCase().trim()).ifPresent(user -> {
            if (user.getRole() != User.UserRole.ADMIN) {
                user.setRole(User.UserRole.ADMIN);
                userRepository.save(user);
                log.info("Bootstrap: granted ADMIN role to {}", bootstrapEmail);
            }
        });
    }
}
