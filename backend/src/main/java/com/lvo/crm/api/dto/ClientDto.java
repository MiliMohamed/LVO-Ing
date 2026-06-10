package com.lvo.crm.api.dto;

public record ClientDto(
        Long id, String raisonSociale, String entite, String email, String telephone, String createdAtIso) {}
