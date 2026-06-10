package com.lvo.crm.onedrive;

import com.lvo.crm.config.OneDriveProperties;
import com.lvo.crm.domain.Site;
import com.lvo.crm.repo.SiteRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Pattern;

/**
 * Crée l'arborescence OneDrive documentée dans {@code arborescence_onedrive_lvo.svg}
 * à chaque nouveau site CRM.
 */
@Service
public class OneDriveService {

    private static final Logger log = LoggerFactory.getLogger(OneDriveService.class);
    private static final Pattern INVALID_FOLDER_CHARS = Pattern.compile("[\\\\/:*?\"<>|]");

    private static final List<String> LEVEL1_FOLDERS = List.of(
            "1-Offre",
            "2-commande & facturation",
            "3-doc Client",
            "4-Avant-Projet",
            "5-Consultation & Analyse",
            "6-exécution");

    private static final List<String> CONCEPTION_SUBFOLDERS = List.of("5.1-DCE", "5.2-analyse");

    private static final List<String> EXECUTION_SUBFOLDERS = List.of(
            "6.1-Amiante",
            "6.2-Courriers",
            "6.3-CR",
            "6.4-DAT",
            "6.5-Marché",
            "6.6-Penalites",
            "6.7-Photos",
            "6.8-Planning",
            "6.9-PV Sit.",
            "6.10-Sous-trait.",
            "6.11-SPS-BC",
            "6.12-Visas");

    private final OneDriveProperties properties;
    private final MicrosoftGraphClient graph;
    private final SiteRepository sites;
    private final ExecutorService folderExecutor = Executors.newFixedThreadPool(8);

    public OneDriveService(
            OneDriveProperties properties, MicrosoftGraphClient graph, SiteRepository sites) {
        this.properties = properties;
        this.graph = graph;
        this.sites = sites;
    }

    public boolean isConfigured() {
        return properties.isConfigured();
    }

    /**
     * Provisionne l'arborescence et enregistre {@code onedrive_folder_id} / {@code onedrive_folder_url} sur le site.
     * Les erreurs OneDrive n'empêchent pas la création du site en base.
     */
    public void provisionSiteTree(Site site) {
        if (!isConfigured()) {
            return;
        }
        try {
            DriveItemRef siteFolder = createSiteTree(site.getNom());
            persistOneDriveRefs(site.getId(), siteFolder);
            log.info("Arborescence OneDrive créée pour le site {} (id={})", site.getNom(), site.getId());
        } catch (Exception e) {
            log.warn(
                    "Création OneDrive ignorée pour le site {} (id={}) : {}",
                    site.getNom(),
                    site.getId(),
                    e.getMessage());
        }
    }

    public DriveItemRef createSiteTree(String siteNom) {
        String sitesRootId = resolveSitesRootFolderId();
        String safeName = sanitizeFolderName(siteNom);
        DriveItemRef siteFolder = graph.createFolder(sitesRootId, safeName);

        List<CompletableFuture<DriveItemRef>> level1Jobs = new ArrayList<>();
        for (String name : LEVEL1_FOLDERS) {
            level1Jobs.add(CompletableFuture.supplyAsync(
                    () -> graph.createFolder(siteFolder.id(), name), folderExecutor));
        }
        List<DriveItemRef> level1 = level1Jobs.stream().map(CompletableFuture::join).toList();

        String conceptionId = level1.get(4).id();
        String executionId = level1.get(5).id();

        CompletableFuture.allOf(
                        CONCEPTION_SUBFOLDERS.stream()
                                .map(n -> CompletableFuture.runAsync(
                                        () -> graph.createFolder(conceptionId, n), folderExecutor))
                                .toArray(CompletableFuture[]::new))
                .join();

        CompletableFuture.allOf(
                        EXECUTION_SUBFOLDERS.stream()
                                .map(n -> CompletableFuture.runAsync(
                                        () -> graph.createFolder(executionId, n), folderExecutor))
                                .toArray(CompletableFuture[]::new))
                .join();

        return siteFolder;
    }

    private String resolveSitesRootFolderId() {
        if (properties.getSitesRootFolderId() != null
                && !properties.getSitesRootFolderId().isBlank()) {
            return properties.getSitesRootFolderId();
        }
        String rootName = properties.getSitesRootFolderName();
        DriveItemRef sitesRoot = graph.getOrCreateFolderByPath("/" + rootName);
        return sitesRoot.id();
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    void persistOneDriveRefs(Long siteId, DriveItemRef folder) {
        sites.findById(siteId).ifPresent(s -> {
            s.setOnedriveFolderId(folder.id());
            s.setOnedriveFolderUrl(folder.webUrl());
            sites.save(s);
        });
    }

    static String sanitizeFolderName(String name) {
        if (name == null || name.isBlank()) {
            return "Site sans nom";
        }
        String trimmed = name.trim();
        String cleaned = INVALID_FOLDER_CHARS.matcher(trimmed).replaceAll("-");
        return cleaned.length() > 200 ? cleaned.substring(0, 200) : cleaned;
    }
}
