package com.lvo.crm.api.dto;

public record ContactDto(
        Long id,
        String civilite,
        String nom,
        String prenom,
        String entreprise,
        String fonction,
        String email,
        String telephone,
        String mobile) {}
