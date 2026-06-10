package com.lvo.crm.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record OffreDto(
        Long id,
        String numeroOffre,
        String typeMission,
        String statut,
        BigDecimal montantHt,
        LocalDate dateOffre,
        String clientNom,
        String siteNom) {}
