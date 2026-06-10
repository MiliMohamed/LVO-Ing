package com.lvo.crm.api;

import com.lvo.crm.api.dto.SiteArborescenceNodeDto;
import com.lvo.crm.api.dto.SiteArborescenceTreeNodeDto;
import com.lvo.crm.service.SiteArborescenceService;
import com.lvo.crm.service.SiteArborescenceService.DownloadPayload;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/api/sites/{siteId}/arborescence")
public class SiteArborescenceController {

    private final SiteArborescenceService arborescenceService;

    public SiteArborescenceController(SiteArborescenceService arborescenceService) {
        this.arborescenceService = arborescenceService;
    }

    @GetMapping
    public List<SiteArborescenceNodeDto> listChildren(
            @PathVariable Long siteId, @RequestParam(required = false) Long parentId) {
        return arborescenceService.listChildren(siteId, parentId);
    }

    @GetMapping("/tree")
    public List<SiteArborescenceTreeNodeDto> tree(@PathVariable Long siteId) {
        return arborescenceService.fullTree(siteId);
    }

    @PostMapping("/nodes/{folderId}/files")
    public SiteArborescenceNodeDto upload(
            @PathVariable Long siteId,
            @PathVariable Long folderId,
            @RequestParam("file") MultipartFile file)
            throws IOException {
        return arborescenceService.uploadFile(siteId, folderId, file);
    }

    @GetMapping("/files/{fileId}/download")
    public ResponseEntity<Resource> download(@PathVariable Long siteId, @PathVariable Long fileId) {
        DownloadPayload payload = arborescenceService.downloadFile(siteId, fileId);
        String encoded = URLEncoder.encode(payload.fileName(), StandardCharsets.UTF_8).replace("+", "%20");
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encoded)
                .contentType(MediaType.parseMediaType(payload.contentType()))
                .contentLength(payload.sizeBytes() != null ? payload.sizeBytes() : -1)
                .body(payload.resource());
    }

    @DeleteMapping("/files/{fileId}")
    public void delete(@PathVariable Long siteId, @PathVariable Long fileId) {
        arborescenceService.deleteFile(siteId, fileId);
    }
}
