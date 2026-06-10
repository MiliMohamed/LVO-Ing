package com.lvo.crm.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CreateFactureRequest(
        @NotBlank String numeroFacture,
        @NotBlank String numeroCommande,
        @NotNull LocalDate dateFacture,
        @NotNull BigDecimal montantHt,
        @NotNull BigDecimal frais,
        String modeReglement,
        String clientNom) {}
