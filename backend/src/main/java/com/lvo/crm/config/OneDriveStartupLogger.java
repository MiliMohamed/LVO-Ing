package com.lvo.crm.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class OneDriveStartupLogger implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(OneDriveStartupLogger.class);

    private final OneDriveProperties onedrive;

    public OneDriveStartupLogger(OneDriveProperties onedrive) {
        this.onedrive = onedrive;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!onedrive.isEnabled()) {
            log.info(
                    "OneDrive désactivé (ONEDRIVE_ENABLED=false). Arborescence non créée à la création de site.");
            return;
        }
        if (onedrive.isConfigured()) {
            log.info(
                    "OneDrive activé pour {} — dossiers Sites sous le compte {}",
                    onedrive.getSitesRootFolderName(),
                    onedrive.getUserPrincipalName());
            return;
        }
        log.warn(
                "OneDrive activé mais configuration incomplète. Renseigner AZURE_TENANT_ID, "
                        + "AZURE_CLIENT_ID, AZURE_CLIENT_SECRET et ONEDRIVE_USER_EMAIL dans backend/.env");
    }
}
