package com.lvo.crm.domain;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "historique_annulations")
public class HistoriqueAnnulation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "entity_type", nullable = false)
    private String entityType;
    @Column(name = "entity_id", nullable = false)
    private Long entityId;
    @Column(nullable = false)
    private String reference;
    @Column(name = "snapshot_json", nullable = false, columnDefinition = "text")
    private String snapshotJson;
    @Column(nullable = false)
    private String motif;
    @Column(columnDefinition = "text")
    private String commentaire;
    @Column(name = "montant_ht", nullable = false, precision = 14, scale = 2)
    private BigDecimal montantHt = BigDecimal.ZERO;
    @Column(name = "client_nom", nullable = false)
    private String clientNom;
    @Column(name = "consultant_code")
    private String consultantCode;
    @Column(name = "cancelled_at", nullable = false)
    private Instant cancelledAt = Instant.now();

    public Long getId() { return id; }
    public String getEntityType() { return entityType; }
    public void setEntityType(String entityType) { this.entityType = entityType; }
    public Long getEntityId() { return entityId; }
    public void setEntityId(Long entityId) { this.entityId = entityId; }
    public String getReference() { return reference; }
    public void setReference(String reference) { this.reference = reference; }
    public String getSnapshotJson() { return snapshotJson; }
    public void setSnapshotJson(String snapshotJson) { this.snapshotJson = snapshotJson; }
    public String getMotif() { return motif; }
    public void setMotif(String motif) { this.motif = motif; }
    public String getCommentaire() { return commentaire; }
    public void setCommentaire(String commentaire) { this.commentaire = commentaire; }
    public BigDecimal getMontantHt() { return montantHt; }
    public void setMontantHt(BigDecimal montantHt) { this.montantHt = montantHt; }
    public String getClientNom() { return clientNom; }
    public void setClientNom(String clientNom) { this.clientNom = clientNom; }
    public String getConsultantCode() { return consultantCode; }
    public void setConsultantCode(String consultantCode) { this.consultantCode = consultantCode; }
    public Instant getCancelledAt() { return cancelledAt; }
}
