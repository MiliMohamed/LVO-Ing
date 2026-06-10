package com.lvo.crm.api;

import com.lvo.crm.api.dto.GenerateDocumentRequest;
import com.lvo.crm.api.dto.ReportKpiDto;
import com.lvo.crm.api.dto.SendEmailRequest;
import com.lvo.crm.domain.HistoriqueAnnulation;
import com.lvo.crm.repo.ContactRepository;
import com.lvo.crm.repo.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@RestController
@RequestMapping("/api")
public class AdvancedModulesController {
    private final OffreRepository offres;
    private final CommandeRepository commandes;
    private final FactureRepository factures;
    private final HistoriqueAnnulationRepository historiqueAnnulations;
    private final HistoriqueDuplicationRepository historiqueDuplications;
    private final ContactRepository contacts;

    public AdvancedModulesController(
            OffreRepository offres,
            CommandeRepository commandes,
            FactureRepository factures,
            HistoriqueAnnulationRepository historiqueAnnulations,
            HistoriqueDuplicationRepository historiqueDuplications,
            ContactRepository contacts) {
        this.offres = offres;
        this.commandes = commandes;
        this.factures = factures;
        this.historiqueAnnulations = historiqueAnnulations;
        this.historiqueDuplications = historiqueDuplications;
        this.contacts = contacts;
    }

    @PostMapping("/documents/offre/generate")
    public ResponseEntity<byte[]> generateOffreDocument(@RequestBody @Valid GenerateDocumentRequest request) {
        return buildDoc("LVO_Offre_" + request.reference(), request.content(), request.format());
    }

    @PostMapping("/documents/commande/generate")
    public ResponseEntity<byte[]> generateCommandeDocument(@RequestBody @Valid GenerateDocumentRequest request) {
        return buildDoc("LVO_Commande_" + request.reference(), request.content(), request.format());
    }

    @PostMapping("/documents/facture/generate")
    public ResponseEntity<byte[]> generateFactureDocument(@RequestBody @Valid GenerateDocumentRequest request) {
        return buildDoc("LVO_Facture_" + request.reference(), request.content(), request.format());
    }

    /** Stub versioning — à relier table PostgreSQL + métadonnées objet S3/MinIO */
    @GetMapping("/documents/versions")
    public List<Map<String, Object>> documentVersions(@RequestParam(required = false) String reference) {
        if (reference == null || reference.isBlank()) {
            return List.of();
        }
        return List.of(
                Map.of(
                        "reference",
                        reference,
                        "version",
                        1,
                        "createdAt",
                        Instant.now().minus(1, ChronoUnit.DAYS).toString(),
                        "author",
                        "system",
                        "storageKey",
                        "stub/" + reference + "-v1.pdf"));
    }

    @PostMapping("/emails/send")
    public Map<String, Object> sendEmail(@RequestBody @Valid SendEmailRequest request) {
        Map<String, Object> resp = new HashMap<>();
        resp.put("status", "queued");
        resp.put("to", request.to());
        resp.put("subject", request.subject());
        resp.put("template", request.templateCode() == null ? "custom" : request.templateCode());
        resp.put("queuedAt", Instant.now().toString());
        return resp;
    }

    @PostMapping("/fichiers/upload")
    public Map<String, Object> upload(@RequestParam("file") MultipartFile file) throws IOException {
        Path dir = Path.of("backend", "uploads");
        Files.createDirectories(dir);
        String name = UUID.randomUUID() + "-" + file.getOriginalFilename();
        Path target = dir.resolve(name);
        Files.write(target, file.getBytes());
        return Map.of("fileName", file.getOriginalFilename(), "storedAs", name, "size", file.getSize());
    }

    /** Préparation URL signées — brancher SDK MinIO / AWS quand `lvo.storage` est configuré */
    @PostMapping("/fichiers/presign")
    public Map<String, Object> presignUpload(@RequestBody(required = false) Map<String, String> body) {
        String prefix = body != null && body.get("prefix") != null ? body.get("prefix") : "uploads/";
        String key = prefix + UUID.randomUUID();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("mode", "stub");
        m.put("objectKey", key);
        m.put(
                "message",
                "Démarrez le service MinIO (docker-compose), créez le bucket lvo-crm-docs puis branchez le SDK pour PUT/GET signés.");
        m.put("consoleUrl", "http://localhost:9001");
        return m;
    }

    @GetMapping("/planning/jalons")
    public List<Map<String, Object>> jalons() {
        Instant now = Instant.now();
        return List.of(
                Map.of(
                        "id",
                        "m-close",
                        "label",
                        "Clôture mensuelle — export CRM",
                        "period",
                        "MONTH",
                        "dueAt",
                        now.plus(12, ChronoUnit.DAYS).toString(),
                        "alertLevel",
                        "info"),
                Map.of(
                        "id",
                        "q-review",
                        "label",
                        "Revue trimestrielle pipeline",
                        "period",
                        "QUARTER",
                        "dueAt",
                        now.plus(45, ChronoUnit.DAYS).toString(),
                        "alertLevel",
                        "warn"),
                Map.of(
                        "id",
                        "phase-end",
                        "label",
                        "Fin de phase — jalons techniques",
                        "period",
                        "PHASE_END",
                        "dueAt",
                        now.plus(5, ChronoUnit.DAYS).toString(),
                        "alertLevel",
                        "critical"));
    }

    @GetMapping("/rapports/kpis")
    public ReportKpiDto kpis() {
        return new ReportKpiDto(
                offres.count(),
                commandes.count(),
                factures.count(),
                historiqueAnnulations.count(),
                historiqueDuplications.count(),
                0L);
    }

    @GetMapping(value = "/rapports/export/kpis.csv", produces = "text/csv;charset=UTF-8")
    public ResponseEntity<String> exportKpisCsv() {
        ReportKpiDto k = kpis();
        String csv =
                "metric,value\n"
                        + "totalOffres,"
                        + k.totalOffres()
                        + "\n"
                        + "totalCommandes,"
                        + k.totalCommandes()
                        + "\n"
                        + "totalFactures,"
                        + k.totalFactures()
                        + "\n"
                        + "totalAnnulations,"
                        + k.totalAnnulations()
                        + "\n"
                        + "totalDuplications,"
                        + k.totalDuplications()
                        + "\n"
                        + "jalonsRetard,"
                        + k.jalonsRetard()
                        + "\n";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"lvo-kpis.csv\"")
                .body(csv);
    }

    @GetMapping(value = "/rapports/export/annulations.csv", produces = "text/csv;charset=UTF-8")
    public ResponseEntity<String> exportAnnulationsCsv() {
        StringBuilder sb = new StringBuilder("id,entityType,entityId,reference,motif,clientNom,montantHt,cancelledAt\n");
        for (HistoriqueAnnulation h : historiqueAnnulations.findTop200ByOrderByCancelledAtDesc()) {
            sb.append(h.getId())
                    .append(',')
                    .append(csvEscape(h.getEntityType()))
                    .append(',')
                    .append(h.getEntityId())
                    .append(',')
                    .append(csvEscape(h.getReference()))
                    .append(',')
                    .append(csvEscape(h.getMotif()))
                    .append(',')
                    .append(csvEscape(h.getClientNom()))
                    .append(',')
                    .append(h.getMontantHt() != null ? h.getMontantHt().toPlainString() : "")
                    .append(',')
                    .append(h.getCancelledAt() != null ? h.getCancelledAt().toString() : "")
                    .append('\n');
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"lvo-annulations.csv\"")
                .body(sb.toString());
    }

    @GetMapping("/rgpd/export")
    public Map<String, Object> exportRgpd(@RequestParam("email") String email) {
        return Map.of("email", email, "exportedAt", Instant.now().toString(), "status", "ready");
    }

    @PostMapping("/rgpd/anonymize")
    public Map<String, Object> anonymizeContact(@RequestParam("contactId") Long contactId) {
        var contact = contacts.findById(contactId).orElseThrow();
        contact.setEmail("anonymized+" + contactId + "@example.invalid");
        contact.setTelephone(null);
        contact.setMobile(null);
        contacts.save(contact);
        return Map.of("contactId", contactId, "status", "anonymized");
    }

    @GetMapping("/rgpd/politiques-retention")
    public List<Map<String, Object>> politiquesRetention() {
        return List.of(
                Map.of("domaine", "Contacts & coordonnées", "dureeAns", 3, "baseLegale", "Contrat / intérêt légitime"),
                Map.of("domaine", "Documents commerciaux", "dureeAns", 10, "baseLegale", "Obligation comptable & probante"),
                Map.of(
                        "domaine",
                        "Historique annulations / duplications",
                        "dureeAns",
                        10,
                        "baseLegale",
                        "Traçabilité métier"),
                Map.of("domaine", "Journaux d'audit techniques", "dureeAns", 2, "baseLegale", "Sécurité de l'information"));
    }

    private static String csvEscape(String s) {
        if (s == null) return "";
        String v = s.replace("\"", "\"\"");
        if (v.contains(",") || v.contains("\n") || v.contains("\"")) {
            return "\"" + v + "\"";
        }
        return v;
    }

    private ResponseEntity<byte[]> buildDoc(String baseName, String content, String format) {
        String f = (format == null || format.isBlank()) ? "pdf" : format.toLowerCase();
        String fileName = baseName + "." + ("docx".equals(f) ? "docx" : "pdf");
        byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(bytes);
    }
}
