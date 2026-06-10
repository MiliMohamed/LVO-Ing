package com.lvo.crm.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record RepartitionRequest(@NotEmpty List<@Valid RepartitionItemDto> items) {}
