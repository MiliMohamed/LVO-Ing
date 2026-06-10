package com.lvo.crm.service;

import com.lvo.crm.api.dto.LoginRequest;
import com.lvo.crm.api.dto.LoginResponse;
import com.lvo.crm.api.dto.RefreshRequest;
import com.lvo.crm.domain.AppUser;
import com.lvo.crm.domain.RefreshToken;
import com.lvo.crm.repo.AppUserRepository;
import com.lvo.crm.repo.RefreshTokenRepository;
import com.lvo.crm.security.JwtService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Service
public class AuthService {

    private final AppUserRepository users;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final int refreshDays;

    public AuthService(
            AppUserRepository users,
            RefreshTokenRepository refreshTokens,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            @Value("${lvo.jwt.refresh-days:7}") int refreshDays) {
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.refreshDays = refreshDays;
    }

    @Transactional
    public LoginResponse login(LoginRequest request) {
        AppUser user = users
                .findByEmailIgnoreCase(request.email().trim())
                .filter(AppUser::isActive)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials"));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }

        String token = jwtService.generateToken(user);
        String refreshToken = issueRefreshToken(user);
        Long agenceId = user.getAgence() != null ? user.getAgence().getId() : null;
        return new LoginResponse(token, refreshToken, user.getEmail(), user.getRole(), user.getId(), agenceId);
    }

    @Transactional
    public LoginResponse refresh(RefreshRequest request) {
        RefreshToken stored = refreshTokens
                .findByToken(request.refreshToken().trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token invalid"));
        if (stored.getRevokedAt() != null || stored.getExpiresAt().isBefore(Instant.now())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token expired");
        }
        AppUser user = stored.getUser();
        if (!user.isActive()) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User inactive");

        stored.setRevokedAt(Instant.now());
        String newRefresh = issueRefreshToken(user);
        String newAccess = jwtService.generateToken(user);
        Long agenceId = user.getAgence() != null ? user.getAgence().getId() : null;
        return new LoginResponse(newAccess, newRefresh, user.getEmail(), user.getRole(), user.getId(), agenceId);
    }

    private String issueRefreshToken(AppUser user) {
        RefreshToken r = new RefreshToken();
        r.setUser(user);
        r.setToken(UUID.randomUUID() + "." + UUID.randomUUID());
        r.setExpiresAt(Instant.now().plus(refreshDays, ChronoUnit.DAYS));
        return refreshTokens.save(r).getToken();
    }
}
