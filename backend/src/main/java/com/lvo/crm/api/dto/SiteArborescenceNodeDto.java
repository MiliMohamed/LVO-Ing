package com.lvo.crm.api.dto;

public record SiteArborescenceNodeDto(
        Long id,
        Long parentId,
        String nom,
        String nodeType,
        int sortOrder,
        Long sizeBytes,
        String contentType,
        int childCount,
        String createdAt) {}
