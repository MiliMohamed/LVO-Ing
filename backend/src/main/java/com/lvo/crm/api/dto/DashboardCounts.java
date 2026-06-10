package com.lvo.crm.api.dto;

public record DashboardCounts(
        long contacts, long clients, long sites, long offresActives, long commandesActives, long factures) {}
