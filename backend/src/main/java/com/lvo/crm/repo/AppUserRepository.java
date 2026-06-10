package com.lvo.crm.repo;

import com.lvo.crm.domain.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AppUserRepository extends JpaRepository<AppUser, Long> {
    Optional<AppUser> findByEmailIgnoreCase(String email);

    Optional<AppUser> findFirstByRoleIgnoreCaseAndActiveTrue(String role);
}
