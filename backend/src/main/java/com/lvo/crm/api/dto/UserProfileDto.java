package com.lvo.crm.api.dto;

public record UserProfileDto(
        Long id,
        String email,
        String role,
        String prenom,
        String nom,
        String telephone,
        boolean hasAvatar,
        Long agenceId,
        String agenceNom) {}
