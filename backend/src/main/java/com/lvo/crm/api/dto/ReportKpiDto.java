package com.lvo.crm.api.dto;

public record ReportKpiDto(
        long totalOffres,
        long totalCommandes,
        long totalFactures,
        long totalAnnulations,
        long totalDuplications,
        long jalonsRetard) {}
