package com.lvo.crm.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record RepartitionItemDto(@NotBlank String codePoste, @NotNull BigDecimal pourcentage) {}
