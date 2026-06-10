package com.lvo.crm.api.dto;

import jakarta.validation.constraints.NotBlank;

public record SendEmailRequest(@NotBlank String to, @NotBlank String subject, @NotBlank String body, String templateCode) {}
