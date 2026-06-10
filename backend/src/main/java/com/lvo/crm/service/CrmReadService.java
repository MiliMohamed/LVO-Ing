package com.lvo.crm.service;

import com.lvo.crm.api.dto.*;
import com.lvo.crm.repo.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
public class CrmReadService {

    private static final ZoneId FR = ZoneId.of("Europe/Paris");
    private static final DateTimeFormatter FR_DATE = DateTimeFormatter.ofPattern("dd/MM/uuuu").withZone(FR);

    private final ContactRepository contacts;
    private final ClientRepository clients;
    private final SiteRepository sites;
    private final OffreRepository offres;
    private final CommandeRepository commandes;
    private final FactureRepository factures;

    public CrmReadService(
            ContactRepository contacts,
            ClientRepository clients,
            SiteRepository sites,
            OffreRepository offres,
            CommandeRepository commandes,
            FactureRepository factures) {
        this.contacts = contacts;
        this.clients = clients;
        this.sites = sites;
        this.offres = offres;
        this.commandes = commandes;
        this.factures = factures;
    }

    @Transactional(readOnly = true)
    public DashboardCounts dashboardCounts() {
        return new DashboardCounts(
                contacts.count(),
                clients.count(),
                sites.count(),
                offres.countByCancelledAtIsNull(),
                commandes.countByCancelledAtIsNull(),
                factures.count());
    }

    @Transactional(readOnly = true)
    public List<ContactDto> contacts() {
        return contacts.findAllFetched().stream()
                .map(c -> new ContactDto(
                        c.getId(),
                        emptyOr(c.getCivilite()),
                        c.getNom(),
                        c.getPrenom(),
                        c.getClient().getRaisonSociale(),
                        emptyOr(c.getFonction()),
                        emptyOr(c.getEmail()),
                        emptyOr(c.getTelephone()),
                        emptyOr(c.getMobile())))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ClientDto> clients() {
        return clients.findAll().stream()
                .map(cl -> new ClientDto(
                        cl.getId(),
                        cl.getRaisonSociale(),
                        emptyOr(cl.getEntite()),
                        emptyOr(cl.getEmail()),
                        emptyOr(cl.getTelephone()),
                        FR_DATE.format(cl.getCreatedAt())))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<SiteDto> sites() {
        return sites.findAllFetched().stream()
                .map(s -> new SiteDto(
                        s.getId(), s.getNom(), emptyOr(s.getTypeSite()), s.getClient().getRaisonSociale()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<OffreDto> offresActives() {
        return offres.findAllActiveFetched().stream()
                .map(o -> new OffreDto(
                        o.getId(),
                        o.getNumeroOffre(),
                        o.getTypeMission(),
                        o.getStatut(),
                        o.getMontantHt(),
                        o.getDateOffre(),
                        o.getSite().getClient().getRaisonSociale(),
                        o.getSite().getNom()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CommandeDto> commandesActives() {
        return commandes.findAllActiveFetched().stream()
                .map(c -> new CommandeDto(
                        c.getId(),
                        c.getNumeroCommande(),
                        c.getDateCommande(),
                        c.getMontantHt(),
                        orZero(c.getMontantFacture()),
                        c.getOffre().getTypeMission(),
                        c.getOffre().getSite().getNom(),
                        c.getOffre().getSite().getClient().getRaisonSociale()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<FactureDto> factures() {
        return factures.findAllFetched().stream()
                .map(f -> new FactureDto(
                        f.getId(),
                        f.getNumeroFacture(),
                        f.getDateFacture(),
                        f.getCommande().getNumeroCommande(),
                        f.getCommande().getOffre().getSite().getClient().getRaisonSociale(),
                        f.getMontantHt(),
                        orZero(f.getFrais()),
                        emptyOr(f.getModeReglement())))
                .toList();
    }

    private static String emptyOr(String s) {
        return s == null || s.isBlank() ? "—" : s;
    }

    private static BigDecimal orZero(BigDecimal b) {
        return b == null ? BigDecimal.ZERO : b;
    }
}
