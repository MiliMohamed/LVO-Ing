package com.lvo.crm.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CreateOffreRequest(
        @NotBlank String numeroOffre,
        @NotBlank String typeMission,
        @NotBlank String statut,
        @NotNull BigDecimal montantHt,
        LocalDate dateOffre,
        @NotBlank String clientNom,
        @NotBlank String siteNom) {}
