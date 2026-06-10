package com.lvo.crm.api.dto;

import jakarta.validation.constraints.Size;

public record UpdateProfileRequest(
        @Size(max = 128) String prenom,
        @Size(max = 128) String nom,
        @Size(max = 32) String telephone) {}
