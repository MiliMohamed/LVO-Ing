package com.lvo.crm.api.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateContactRequest(
        @NotBlank String clientNom,
        String civilite,
        @NotBlank String nom,
        @NotBlank String prenom,
        String fonction,
        String email,
        String telephone,
        String mobile) {}
