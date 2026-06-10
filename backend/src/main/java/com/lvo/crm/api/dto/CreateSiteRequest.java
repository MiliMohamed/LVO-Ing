package com.lvo.crm.api.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateSiteRequest(@NotBlank String clientNom, @NotBlank String nom, String typeSite, String adresse) {}
