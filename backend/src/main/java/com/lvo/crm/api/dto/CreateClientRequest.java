package com.lvo.crm.api.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateClientRequest(
        @NotBlank String raisonSociale,
        String entite,
        String email,
        String telephone,
        String typeClient,
        String siret) {}
