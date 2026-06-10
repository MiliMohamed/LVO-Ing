package com.lvo.crm.domain;

import jakarta.persistence.*;

import java.math.BigDecimal;

@Entity
@Table(name = "repartitions_honoraires")
public class RepartitionHonoraire {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "facture_id")
    private Facture facture;
    @Column(name = "code_poste", nullable = false)
    private String codePoste;
    @Column(nullable = false, precision = 6, scale = 2)
    private BigDecimal pourcentage;

    public void setFacture(Facture facture) { this.facture = facture; }
    public void setCodePoste(String codePoste) { this.codePoste = codePoste; }
    public void setPourcentage(BigDecimal pourcentage) { this.pourcentage = pourcentage; }
    public BigDecimal getPourcentage() { return pourcentage; }
}
