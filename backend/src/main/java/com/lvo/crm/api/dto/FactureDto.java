package com.lvo.crm.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record FactureDto(
        Long id,
        String numeroFacture,
        LocalDate dateFacture,
        String numeroCommande,
        String clientNom,
        BigDecimal montantHt,
        BigDecimal frais,
        String modeReglement) {}
