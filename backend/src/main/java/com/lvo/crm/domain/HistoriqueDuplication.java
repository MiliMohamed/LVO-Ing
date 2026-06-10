package com.lvo.crm.domain;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "historique_duplications")
public class HistoriqueDuplication {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "entity_type", nullable = false)
    private String entityType;
    @Column(name = "source_id", nullable = false)
    private Long sourceId;
    @Column(name = "target_id", nullable = false)
    private Long targetId;
    @Column(name = "source_ref", nullable = false)
    private String sourceRef;
    @Column(name = "target_ref", nullable = false)
    private String targetRef;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public void setEntityType(String entityType) { this.entityType = entityType; }
    public void setSourceId(Long sourceId) { this.sourceId = sourceId; }
    public void setTargetId(Long targetId) { this.targetId = targetId; }
    public void setSourceRef(String sourceRef) { this.sourceRef = sourceRef; }
    public void setTargetRef(String targetRef) { this.targetRef = targetRef; }
    public Long getId() { return id; }
    public String getEntityType() { return entityType; }
    public Long getSourceId() { return sourceId; }
    public Long getTargetId() { return targetId; }
    public String getSourceRef() { return sourceRef; }
    public String getTargetRef() { return targetRef; }
    public Instant getCreatedAt() { return createdAt; }
}
