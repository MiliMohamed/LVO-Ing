package com.lvo.crm.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CommandeDto(
        Long id,
        String numeroCommande,
        LocalDate dateCommande,
        BigDecimal montantHt,
        BigDecimal montantFacture,
        String typeMission,
        String siteNom,
        String clientNom) {}
