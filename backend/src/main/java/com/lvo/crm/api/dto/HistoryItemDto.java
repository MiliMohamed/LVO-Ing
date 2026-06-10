package com.lvo.crm.api.dto;

import java.math.BigDecimal;
import java.time.Instant;

public record HistoryItemDto(
        Long id,
        String entityType,
        Long entityId,
        String reference,
        String motif,
        String commentaire,
        BigDecimal montantHt,
        String clientNom,
        Instant cancelledAt) {}
