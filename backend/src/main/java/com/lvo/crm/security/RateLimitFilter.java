package com.lvo.crm.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class RateLimitFilter extends OncePerRequestFilter {
    private static final int LIMIT_PUBLIC_PER_MIN = 100;
    private static final int LIMIT_AUTH_PER_MIN = 1000;
    private final Map<String, Counter> counters = new ConcurrentHashMap<>();

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String ip = request.getRemoteAddr() == null ? "unknown" : request.getRemoteAddr();
        boolean auth = request.getHeader("Authorization") != null;
        int limit = auth ? LIMIT_AUTH_PER_MIN : LIMIT_PUBLIC_PER_MIN;
        String key = ip + ":" + auth;
        long minute = Instant.now().getEpochSecond() / 60L;
        Counter c = counters.compute(key, (k, old) -> {
            if (old == null || old.minute != minute) return new Counter(minute, 1);
            old.count++;
            return old;
        });
        if (c.count > limit) {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write("{\"error\":\"rate_limit_exceeded\"}");
            return;
        }
        filterChain.doFilter(request, response);
    }

    private static final class Counter {
        long minute;
        int count;
        Counter(long minute, int count) {
            this.minute = minute;
            this.count = count;
        }
    }
}
