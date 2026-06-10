package com.lvo.crm.api.dto;

public record LoginResponse(
        String token, String refreshToken, String email, String role, Long userId, Long agenceId) {}
