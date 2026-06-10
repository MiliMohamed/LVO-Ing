package com.lvo.crm.api.dto;

import java.time.Instant;

public record DuplicationItemDto(
        Long id,
        String entityType,
        Long sourceId,
        Long targetId,
        String sourceRef,
        String targetRef,
        Instant createdAt) {}
