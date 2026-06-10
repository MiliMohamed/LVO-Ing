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

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "echeancier_facturation")
public class EcheancierFacturation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "commande_id")
    private Commande commande;

    @Column(name = "type_jalon", nullable = false)
    private String typeJalon;

    @Column(name = "date_echeance", nullable = false)
    private LocalDate dateEcheance;

    @Column(name = "montant_ht", nullable = false, precision = 14, scale = 2)
    private BigDecimal montantHt;

    @Column(nullable = false, length = 64)
    private String statut;

    public String getTypeJalon() {
        return typeJalon;
    }

    public LocalDate getDateEcheance() {
        return dateEcheance;
    }

    public BigDecimal getMontantHt() {
        return montantHt;
    }

    public String getStatut() {
        return statut;
    }
}
