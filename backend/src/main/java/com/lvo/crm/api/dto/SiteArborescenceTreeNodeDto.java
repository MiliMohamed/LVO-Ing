package com.lvo.crm.api.dto;

import java.util.List;

public record SiteArborescenceTreeNodeDto(
        Long id,
        Long parentId,
        String nom,
        String nodeType,
        int sortOrder,
        Long sizeBytes,
        String contentType,
        String createdAt,
        List<SiteArborescenceTreeNodeDto> children) {}
