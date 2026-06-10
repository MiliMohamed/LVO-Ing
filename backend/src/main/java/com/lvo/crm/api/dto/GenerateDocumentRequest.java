package com.lvo.crm.api.dto;

import jakarta.validation.constraints.NotBlank;

public record GenerateDocumentRequest(@NotBlank String reference, @NotBlank String content, String format) {}
