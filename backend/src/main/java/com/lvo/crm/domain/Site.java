package com.lvo.crm.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "sites")
public class Site {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "client_id")
    private Client client;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "consultant_id")
    private AppUser consultant;

    @Column(nullable = false)
    private String nom;

    @Column(columnDefinition = "text")
    private String adresse;

    @Column(name = "type_site", length = 64)
    private String typeSite;

    @Column(name = "onedrive_folder_id")
    private String onedriveFolderId;

    @Column(name = "onedrive_folder_url", columnDefinition = "text")
    private String onedriveFolderUrl;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public Long getId() {
        return id;
    }

    public Client getClient() {
        return client;
    }

    public void setClient(Client client) {
        this.client = client;
    }

    public String getNom() {
        return nom;
    }

    public void setNom(String nom) {
        this.nom = nom;
    }

    public String getAdresse() {
        return adresse;
    }

    public void setAdresse(String adresse) {
        this.adresse = adresse;
    }

    public String getTypeSite() {
        return typeSite;
    }

    public void setTypeSite(String typeSite) {
        this.typeSite = typeSite;
    }

    public void setConsultant(AppUser consultant) {
        this.consultant = consultant;
    }

    public String getOnedriveFolderId() {
        return onedriveFolderId;
    }

    public void setOnedriveFolderId(String onedriveFolderId) {
        this.onedriveFolderId = onedriveFolderId;
    }

    public String getOnedriveFolderUrl() {
        return onedriveFolderUrl;
    }

    public void setOnedriveFolderUrl(String onedriveFolderUrl) {
        this.onedriveFolderUrl = onedriveFolderUrl;
    }
}
