package com.lvo.crm.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "lvo.onedrive")
public class OneDriveProperties {

    /** Active la création automatique d'arborescence (nécessite Azure AD configuré). */
    private boolean enabled = false;

    private String tenantId = "";
    private String clientId = "";
    private String clientSecret = "";

    /** Compte Microsoft 365 dont le OneDrive recevra les dossiers Sites/. */
    private String userPrincipalName = "";

    /**
     * ID du dossier parent « Sites » (optionnel).
     * Si vide, le dossier est résolu ou créé à la racine du drive via son nom.
     */
    private String sitesRootFolderId = "";

    private String sitesRootFolderName = "Sites";

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getTenantId() {
        return tenantId;
    }

    public void setTenantId(String tenantId) {
        this.tenantId = tenantId;
    }

    public String getClientId() {
        return clientId;
    }

    public void setClientId(String clientId) {
        this.clientId = clientId;
    }

    public String getClientSecret() {
        return clientSecret;
    }

    public void setClientSecret(String clientSecret) {
        this.clientSecret = clientSecret;
    }

    public String getUserPrincipalName() {
        return userPrincipalName;
    }

    public void setUserPrincipalName(String userPrincipalName) {
        this.userPrincipalName = userPrincipalName;
    }

    public String getSitesRootFolderId() {
        return sitesRootFolderId;
    }

    public void setSitesRootFolderId(String sitesRootFolderId) {
        this.sitesRootFolderId = sitesRootFolderId;
    }

    public String getSitesRootFolderName() {
        return sitesRootFolderName;
    }

    public void setSitesRootFolderName(String sitesRootFolderName) {
        this.sitesRootFolderName = sitesRootFolderName;
    }

    public boolean isConfigured() {
        return enabled
                && tenantId != null
                && !tenantId.isBlank()
                && clientId != null
                && !clientId.isBlank()
                && clientSecret != null
                && !clientSecret.isBlank()
                && userPrincipalName != null
                && !userPrincipalName.isBlank();
    }
}
