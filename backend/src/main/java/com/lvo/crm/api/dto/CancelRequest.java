package com.lvo.crm.api.dto;

import jakarta.validation.constraints.NotBlank;

public record CancelRequest(@NotBlank String motif, String commentaire) {}
