package com.lvo.crm.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CreateCommandeRequest(
        @NotBlank String numeroCommande,
        @NotNull LocalDate dateCommande,
        @NotNull BigDecimal montantHt,
        @NotNull BigDecimal montantFacture,
        String typeMission,
        @NotBlank String clientNom,
        @NotBlank String siteNom) {}
