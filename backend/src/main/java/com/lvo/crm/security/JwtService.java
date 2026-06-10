package com.lvo.crm.security;

import com.lvo.crm.domain.AppUser;
import com.lvo.crm.repo.AppUserRepository;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.Optional;

@Service
public class JwtService {

    private final SecretKey key;
    private final int expirationHours;

    public JwtService(
            @Value("${lvo.jwt.secret}") String secret, @Value("${lvo.jwt.expiration-hours}") int expirationHours) {
        byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            throw new IllegalStateException("lvo.jwt.secret must be at least 256 bits (32 ASCII chars)");
        }
        this.key = Keys.hmacShaKeyFor(bytes);
        this.expirationHours = expirationHours;
    }

    public String generateToken(AppUser user) {
        Instant now = Instant.now();
        var builder = Jwts.builder()
                .setSubject(user.getEmail())
                .claim("role", user.getRole())
                .claim("uid", user.getId())
                .setIssuedAt(Date.from(now))
                .setExpiration(Date.from(now.plus(expirationHours, ChronoUnit.HOURS)))
                .signWith(key);
        if (user.getAgence() != null) {
            builder.claim("agenceId", user.getAgence().getId());
        }
        return builder.compact();
    }

    public Optional<String> parseSubject(String token) {
        try {
            Claims claims = Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token).getBody();
            return Optional.ofNullable(claims.getSubject());
        } catch (Exception e) {
            return Optional.empty();
        }
    }
}
