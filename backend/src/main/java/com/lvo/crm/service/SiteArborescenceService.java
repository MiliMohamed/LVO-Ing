package com.lvo.crm.service;

import com.lvo.crm.api.dto.SiteArborescenceNodeDto;
import com.lvo.crm.api.dto.SiteArborescenceTreeNodeDto;
import com.lvo.crm.domain.AppUser;
import com.lvo.crm.domain.Site;
import com.lvo.crm.domain.SiteArborescenceNode;
import com.lvo.crm.repo.SiteArborescenceNodeRepository;
import com.lvo.crm.repo.SiteRepository;
import com.lvo.crm.security.CurrentUserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Arborescence documentaire interne — même structure que {@code arborescence_onedrive_lvo.svg}.
 */
@Service
public class SiteArborescenceService {

    private static final Logger log = LoggerFactory.getLogger(SiteArborescenceService.class);
    private static final long MAX_FILE_BYTES = 50L * 1024 * 1024;

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

    private final SiteArborescenceNodeRepository nodes;
    private final SiteRepository sites;
    private final CurrentUserService currentUserService;
    private final Path uploadRoot;

    public SiteArborescenceService(
            SiteArborescenceNodeRepository nodes, SiteRepository sites, CurrentUserService currentUserService) {
        this.nodes = nodes;
        this.sites = sites;
        this.currentUserService = currentUserService;
        this.uploadRoot = Path.of("backend", "uploads", "sites");
    }

    @Transactional
    public void provisionSiteTree(Site site) {
        if (nodes.existsBySiteId(site.getId())) {
            return;
        }
        List<SiteArborescenceNode> level1 = new ArrayList<>();
        for (int i = 0; i < LEVEL1_FOLDERS.size(); i++) {
            level1.add(saveFolder(site, null, LEVEL1_FOLDERS.get(i), i));
        }
        SiteArborescenceNode conception = level1.get(4);
        for (int i = 0; i < CONCEPTION_SUBFOLDERS.size(); i++) {
            saveFolder(site, conception, CONCEPTION_SUBFOLDERS.get(i), i);
        }
        SiteArborescenceNode execution = level1.get(5);
        for (int i = 0; i < EXECUTION_SUBFOLDERS.size(); i++) {
            saveFolder(site, execution, EXECUTION_SUBFOLDERS.get(i), i);
        }
        log.info("Arborescence interne créée pour le site {} (id={})", site.getNom(), site.getId());
    }

    @Transactional(readOnly = true)
    public List<SiteArborescenceNodeDto> listChildren(Long siteId, Long parentId) {
        requireSite(siteId);
        return nodes.findChildren(siteId, parentId).stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public List<SiteArborescenceTreeNodeDto> fullTree(Long siteId) {
        requireSite(siteId);
        List<SiteArborescenceNode> all = nodes.findAllBySiteId(siteId);
        if (all.isEmpty()) {
            return List.of();
        }
        Map<Long, List<SiteArborescenceNode>> byParent = new HashMap<>();
        for (SiteArborescenceNode node : all) {
            Long pid = node.getParent() != null ? node.getParent().getId() : null;
            byParent.computeIfAbsent(pid, k -> new ArrayList<>()).add(node);
        }
        return buildTree(byParent, null);
    }

    @Transactional
    public SiteArborescenceNodeDto uploadFile(Long siteId, Long folderId, MultipartFile file) throws IOException {
        AppUser actor = currentUserService.requireCurrentUser();
        forbidViewer(actor);
        Site site = requireSite(siteId);
        SiteArborescenceNode folder = nodes.findByIdAndSiteId(folderId, siteId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Dossier introuvable"));
        if (!SiteArborescenceNode.TYPE_FOLDER.equals(folder.getNodeType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le nœud cible n'est pas un dossier");
        }
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fichier requis");
        }
        if (file.getSize() > MAX_FILE_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fichier trop volumineux (max 50 Mo)");
        }
        String originalName = sanitizeFileName(file.getOriginalFilename());
        Files.createDirectories(uploadRoot.resolve(String.valueOf(siteId)));
        String storedName = UUID.randomUUID() + "-" + originalName;
        Path target = uploadRoot.resolve(String.valueOf(siteId)).resolve(storedName);
        Files.write(target, file.getBytes());

        SiteArborescenceNode fileNode = new SiteArborescenceNode();
        fileNode.setSite(site);
        fileNode.setParent(folder);
        fileNode.setNodeType(SiteArborescenceNode.TYPE_FILE);
        fileNode.setNom(originalName);
        fileNode.setSortOrder(0);
        fileNode.setStoredPath(target.toString().replace('\\', '/'));
        fileNode.setContentType(file.getContentType());
        fileNode.setSizeBytes(file.getSize());
        fileNode.setUploadedBy(actor);
        return toDto(nodes.save(fileNode));
    }

    @Transactional(readOnly = true)
    public DownloadPayload downloadFile(Long siteId, Long fileId) {
        SiteArborescenceNode file = nodes.findByIdAndSiteId(fileId, siteId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Fichier introuvable"));
        if (!SiteArborescenceNode.TYPE_FILE.equals(file.getNodeType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le nœud n'est pas un fichier");
        }
        if (file.getStoredPath() == null || file.getStoredPath().isBlank()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Fichier physique introuvable");
        }
        try {
            Path path = Path.of(file.getStoredPath());
            Resource resource = new UrlResource(path.toUri());
            if (!resource.exists() || !resource.isReadable()) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Fichier physique introuvable");
            }
            String contentType = file.getContentType() != null ? file.getContentType() : "application/octet-stream";
            return new DownloadPayload(resource, file.getNom(), contentType, file.getSizeBytes());
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Fichier physique introuvable");
        }
    }

    @Transactional
    public void deleteFile(Long siteId, Long fileId) {
        AppUser actor = currentUserService.requireCurrentUser();
        forbidViewer(actor);
        SiteArborescenceNode file = nodes.findByIdAndSiteId(fileId, siteId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Fichier introuvable"));
        if (!SiteArborescenceNode.TYPE_FILE.equals(file.getNodeType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le nœud n'est pas un fichier");
        }
        deletePhysicalFile(file.getStoredPath());
        nodes.delete(file);
    }

    private SiteArborescenceNode saveFolder(Site site, SiteArborescenceNode parent, String name, int sortOrder) {
        SiteArborescenceNode folder = new SiteArborescenceNode();
        folder.setSite(site);
        folder.setParent(parent);
        folder.setNodeType(SiteArborescenceNode.TYPE_FOLDER);
        folder.setNom(name);
        folder.setSortOrder(sortOrder);
        return nodes.save(folder);
    }

    private List<SiteArborescenceTreeNodeDto> buildTree(
            Map<Long, List<SiteArborescenceNode>> byParent, Long parentId) {
        List<SiteArborescenceNode> children = byParent.getOrDefault(parentId, List.of());
        List<SiteArborescenceTreeNodeDto> result = new ArrayList<>();
        for (SiteArborescenceNode node : children) {
            List<SiteArborescenceTreeNodeDto> sub =
                    SiteArborescenceNode.TYPE_FOLDER.equals(node.getNodeType())
                            ? buildTree(byParent, node.getId())
                            : List.of();
            result.add(new SiteArborescenceTreeNodeDto(
                    node.getId(),
                    parentId,
                    node.getNom(),
                    node.getNodeType(),
                    node.getSortOrder(),
                    node.getSizeBytes(),
                    node.getContentType(),
                    node.getCreatedAt().toString(),
                    sub));
        }
        return result;
    }

    private SiteArborescenceNodeDto toDto(SiteArborescenceNode node) {
        int childCount = 0;
        if (SiteArborescenceNode.TYPE_FOLDER.equals(node.getNodeType())) {
            childCount = nodes.findChildren(node.getSite().getId(), node.getId()).size();
        }
        return new SiteArborescenceNodeDto(
                node.getId(),
                node.getParent() != null ? node.getParent().getId() : null,
                node.getNom(),
                node.getNodeType(),
                node.getSortOrder(),
                node.getSizeBytes(),
                node.getContentType(),
                childCount,
                node.getCreatedAt().toString());
    }

    private Site requireSite(Long siteId) {
        return sites.findById(siteId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Site introuvable"));
    }

    private void forbidViewer(AppUser actor) {
        if (currentUserService.hasRole(actor, "VIEWER")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Role VIEWER cannot modify data");
        }
    }

    private static void deletePhysicalFile(String storedPath) {
        if (storedPath == null || storedPath.isBlank()) {
            return;
        }
        try {
            Files.deleteIfExists(Path.of(storedPath));
        } catch (IOException e) {
            log.warn("Impossible de supprimer le fichier {} : {}", storedPath, e.getMessage());
        }
    }

    static String sanitizeFileName(String name) {
        if (name == null || name.isBlank()) {
            return "fichier";
        }
        String cleaned = name.replace('\\', '-').replace('/', '-').trim();
        return cleaned.length() > 200 ? cleaned.substring(0, 200) : cleaned;
    }

    public record DownloadPayload(Resource resource, String fileName, String contentType, Long sizeBytes) {}
}
