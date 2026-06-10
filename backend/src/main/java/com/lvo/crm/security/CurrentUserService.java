package com.lvo.crm.security;

import com.lvo.crm.domain.AppUser;
import com.lvo.crm.repo.AppUserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CurrentUserService {
    private final AppUserRepository users;

    public CurrentUserService(AppUserRepository users) {
        this.users = users;
    }

    public AppUser requireCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication() != null
                ? String.valueOf(SecurityContextHolder.getContext().getAuthentication().getPrincipal())
                : null;
        if (email == null || email.isBlank()) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Auth required");
        return users.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }

    public boolean hasRole(AppUser user, String role) {
        return role.equalsIgnoreCase(user.getRole());
    }

    public boolean hasAnyRole(AppUser user, String... roles) {
        for (String r : roles) if (hasRole(user, r)) return true;
        return false;
    }
}
