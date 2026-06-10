package com.lvo.crm.config;

import com.lvo.crm.repo.AppUserRepository;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class DemoPasswordBootstrap {

    @Bean
    ApplicationRunner fixDemoPasswords(AppUserRepository users, PasswordEncoder encoder) {
        return args -> users.findAll().forEach(u -> {
            String h = u.getPasswordHash();
            if (h != null && h.contains("placeholder")) {
                u.setPasswordHash(encoder.encode("lvo123"));
                users.save(u);
            }
        });
    }
}
