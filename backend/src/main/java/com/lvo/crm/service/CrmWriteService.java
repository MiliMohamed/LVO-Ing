package com.lvo.crm.service;

import com.lvo.crm.api.dto.*;
import com.lvo.crm.domain.*;
import com.lvo.crm.repo.*;
import com.lvo.crm.security.CurrentUserService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class CrmWriteService {

    private final ContactRepository contacts;
    private final ClientRepository clients;
    private final SiteRepository sites;
    private final OffreRepository offres;
    private final CommandeRepository commandes;
    private final FactureRepository factures;
    private final HistoriqueAnnulationRepository historiqueAnnulations;
    private final HistoriqueDuplicationRepository historiqueDuplications;
    private final RepartitionHonoraireRepository repartitions;
    private final AppUserRepository users;
    private final CurrentUserService currentUserService;
    private final SiteArborescenceService siteArborescenceService;

    public CrmWriteService(
            ContactRepository contacts,
            ClientRepository clients,
            SiteRepository sites,
            OffreRepository offres,
            CommandeRepository commandes,
            FactureRepository factures,
            HistoriqueAnnulationRepository historiqueAnnulations,
            HistoriqueDuplicationRepository historiqueDuplications,
            RepartitionHonoraireRepository repartitions,
            AppUserRepository users,
            CurrentUserService currentUserService,
            SiteArborescenceService siteArborescenceService) {
        this.contacts = contacts;
        this.clients = clients;
        this.sites = sites;
        this.offres = offres;
        this.commandes = commandes;
        this.factures = factures;
        this.historiqueAnnulations = historiqueAnnulations;
        this.historiqueDuplications = historiqueDuplications;
        this.repartitions = repartitions;
        this.users = users;
        this.currentUserService = currentUserService;
        this.siteArborescenceService = siteArborescenceService;
    }

    @Transactional
    public ContactDto createContact(CreateContactRequest req) {
        AppUser actor = currentUserService.requireCurrentUser();
        forbidViewer(actor);
        Client client = requireClient(req.clientNom());
        Contact c = new Contact();
        c.setClient(client);
        c.setCivilite(trim(req.civilite()));
        c.setNom(trim(req.nom()));
        c.setPrenom(trim(req.prenom()));
        c.setFonction(trim(req.fonction()));
        c.setEmail(trim(req.email()));
        c.setTelephone(trim(req.telephone()));
        c.setMobile(trim(req.mobile()));
        Contact saved = contacts.save(c);
        return new ContactDto(
                saved.getId(),
                emptyOr(saved.getCivilite()),
                saved.getNom(),
                saved.getPrenom(),
                client.getRaisonSociale(),
                emptyOr(saved.getFonction()),
                emptyOr(saved.getEmail()),
                emptyOr(saved.getTelephone()),
                emptyOr(saved.getMobile()));
    }

    @Transactional
    public ClientDto createClient(CreateClientRequest req) {
        AppUser actor = currentUserService.requireCurrentUser();
        forbidViewer(actor);
        Client cl = new Client();
        cl.setRaisonSociale(trim(req.raisonSociale()));
        cl.setEntite(trim(req.entite()));
        cl.setEmail(trim(req.email()));
        cl.setTelephone(trim(req.telephone()));
        cl.setTypeClient(trim(req.typeClient()));
        cl.setSiret(trim(req.siret()));
        Client saved = clients.save(cl);
        return new ClientDto(
                saved.getId(),
                saved.getRaisonSociale(),
                emptyOr(saved.getEntite()),
                emptyOr(saved.getEmail()),
                emptyOr(saved.getTelephone()),
                saved.getCreatedAt().toString());
    }

    @Transactional
    public SiteDto createSite(CreateSiteRequest req) {
        AppUser actor = currentUserService.requireCurrentUser();
        forbidViewer(actor);
        Client client = requireClient(req.clientNom());
        Site site = new Site();
        site.setClient(client);
        site.setNom(trim(req.nom()));
        site.setTypeSite(trim(req.typeSite()));
        site.setAdresse(trim(req.adresse()));
        users.findFirstByRoleIgnoreCaseAndActiveTrue("CONSULTANT").ifPresent(site::setConsultant);
        Site saved = sites.save(site);
        siteArborescenceService.provisionSiteTree(saved);
        return new SiteDto(saved.getId(), saved.getNom(), emptyOr(saved.getTypeSite()), client.getRaisonSociale());
    }

    @Transactional
    public OffreDto createOffre(CreateOffreRequest req) {
        AppUser actor = currentUserService.requireCurrentUser();
        forbidViewer(actor);
        if (offres.findByNumeroOffreIgnoreCase(req.numeroOffre()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Numéro d'offre déjà existant");
        }
        Site site = requireSite(req.siteNom(), req.clientNom());
        Offre offre = new Offre();
        offre.setSite(site);
        offre.setNumeroOffre(trim(req.numeroOffre()));
        offre.setTypeMission(trim(req.typeMission()));
        offre.setStatut(trim(req.statut()));
        offre.setMontantHt(nonNegative(req.montantHt(), "montantHt"));
        offre.setDateOffre(req.dateOffre() != null ? req.dateOffre() : LocalDate.now());
        users.findFirstByRoleIgnoreCaseAndActiveTrue("CONSULTANT").ifPresent(offre::setConsultant);
        Offre saved = offres.save(offre);
        return new OffreDto(
                saved.getId(),
                saved.getNumeroOffre(),
                saved.getTypeMission(),
                saved.getStatut(),
                saved.getMontantHt(),
                saved.getDateOffre(),
                site.getClient().getRaisonSociale(),
                site.getNom());
    }

    @Transactional
    public CommandeDto createCommande(CreateCommandeRequest req) {
        AppUser actor = currentUserService.requireCurrentUser();
        forbidViewer(actor);
        if (commandes.findByNumeroCommandeIgnoreCase(req.numeroCommande()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Numéro de commande déjà existant");
        }
        Site site = requireSite(req.siteNom(), req.clientNom());
        Offre offre = findOpenOffreBySite(site.getId(), trim(req.typeMission()));
        Commande c = new Commande();
        c.setOffre(offre);
        c.setNumeroCommande(trim(req.numeroCommande()));
        c.setDateCommande(req.dateCommande());
        c.setMontantHt(nonNegative(req.montantHt(), "montantHt"));
        c.setMontantFacture(nonNegative(req.montantFacture(), "montantFacture"));
        Commande saved = commandes.save(c);
        return new CommandeDto(
                saved.getId(),
                saved.getNumeroCommande(),
                saved.getDateCommande(),
                saved.getMontantHt(),
                saved.getMontantFacture(),
                offre.getTypeMission(),
                site.getNom(),
                site.getClient().getRaisonSociale());
    }

    @Transactional
    public FactureDto createFacture(CreateFactureRequest req) {
        AppUser actor = currentUserService.requireCurrentUser();
        forbidViewer(actor);
        Commande cmd = commandes.findByNumeroCommandeIgnoreCase(trim(req.numeroCommande()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Commande introuvable"));
        Facture f = new Facture();
        f.setCommande(cmd);
        f.setNumeroFacture(trim(req.numeroFacture()));
        f.setDateFacture(req.dateFacture());
        f.setMontantHt(nonNegative(req.montantHt(), "montantHt"));
        f.setFrais(nonNegative(req.frais(), "frais"));
        f.setModeReglement(trim(req.modeReglement()));
        f.setStatut("EMISE");
        Facture saved = factures.save(f);
        return new FactureDto(
                saved.getId(),
                saved.getNumeroFacture(),
                saved.getDateFacture(),
                cmd.getNumeroCommande(),
                cmd.getOffre().getSite().getClient().getRaisonSociale(),
                saved.getMontantHt(),
                saved.getFrais(),
                emptyOr(saved.getModeReglement()));
    }

    @Transactional
    public ContactDto updateContact(Long id, Map<String, Object> patch) {
        AppUser actor = currentUserService.requireCurrentUser();
        forbidViewer(actor);
        Contact c = contacts.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contact introuvable"));
        if (patch.containsKey("entreprise") || patch.containsKey("clientNom")) {
            String clientNom = asString(patch.getOrDefault("clientNom", patch.get("entreprise")));
            if (clientNom != null && !clientNom.isBlank()) c.setClient(requireClient(clientNom));
        }
        if (patch.containsKey("civilite")) c.setCivilite(asString(patch.get("civilite")));
        if (patch.containsKey("nom")) c.setNom(required(asString(patch.get("nom")), "nom"));
        if (patch.containsKey("prenom")) c.setPrenom(required(asString(patch.get("prenom")), "prenom"));
        if (patch.containsKey("fonction")) c.setFonction(asString(patch.get("fonction")));
        if (patch.containsKey("email")) c.setEmail(asString(patch.get("email")));
        if (patch.containsKey("telephone")) c.setTelephone(asString(patch.get("telephone")));
        if (patch.containsKey("mobile")) c.setMobile(asString(patch.get("mobile")));
        Contact saved = contacts.save(c);
        return new ContactDto(saved.getId(), emptyOr(saved.getCivilite()), saved.getNom(), saved.getPrenom(),
                saved.getClient().getRaisonSociale(), emptyOr(saved.getFonction()), emptyOr(saved.getEmail()),
                emptyOr(saved.getTelephone()), emptyOr(saved.getMobile()));
    }

    @Transactional
    public ClientDto updateClient(Long id, Map<String, Object> patch) {
        AppUser actor = currentUserService.requireCurrentUser();
        forbidViewer(actor);
        Client c = clients.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Client introuvable"));
        if (patch.containsKey("raisonSociale")) c.setRaisonSociale(required(asString(patch.get("raisonSociale")), "raisonSociale"));
        if (patch.containsKey("entite")) c.setEntite(asString(patch.get("entite")));
        if (patch.containsKey("email")) c.setEmail(asString(patch.get("email")));
        if (patch.containsKey("telephone")) c.setTelephone(asString(patch.get("telephone")));
        Client saved = clients.save(c);
        return new ClientDto(saved.getId(), saved.getRaisonSociale(), emptyOr(saved.getEntite()), emptyOr(saved.getEmail()),
                emptyOr(saved.getTelephone()), saved.getCreatedAt().toString());
    }

    @Transactional
    public SiteDto updateSite(Long id, Map<String, Object> patch) {
        AppUser actor = currentUserService.requireCurrentUser();
        forbidViewer(actor);
        Site s = sites.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Site introuvable"));
        if (patch.containsKey("clientNom")) s.setClient(requireClient(asString(patch.get("clientNom"))));
        if (patch.containsKey("nom")) s.setNom(required(asString(patch.get("nom")), "nom"));
        if (patch.containsKey("typeSite")) s.setTypeSite(asString(patch.get("typeSite")));
        if (patch.containsKey("adresse")) s.setAdresse(asString(patch.get("adresse")));
        Site saved = sites.save(s);
        return new SiteDto(saved.getId(), saved.getNom(), emptyOr(saved.getTypeSite()), saved.getClient().getRaisonSociale());
    }

    @Transactional
    public OffreDto updateOffre(Long id, Map<String, Object> patch) {
        AppUser actor = currentUserService.requireCurrentUser();
        forbidViewer(actor);
        Offre o = offres.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Offre introuvable"));
        if (patch.containsKey("clientNom") || patch.containsKey("siteNom")) {
            String clientNom = asString(patch.getOrDefault("clientNom", o.getSite().getClient().getRaisonSociale()));
            String siteNom = asString(patch.getOrDefault("siteNom", o.getSite().getNom()));
            o.setSite(requireSite(siteNom, clientNom));
        }
        if (patch.containsKey("numeroOffre")) o.setNumeroOffre(required(asString(patch.get("numeroOffre")), "numeroOffre"));
        if (patch.containsKey("typeMission")) o.setTypeMission(required(asString(patch.get("typeMission")), "typeMission"));
        if (patch.containsKey("statut")) o.setStatut(required(asString(patch.get("statut")), "statut"));
        if (patch.containsKey("montantHt")) o.setMontantHt(nonNegative(asBigDecimal(patch.get("montantHt")), "montantHt"));
        if (patch.containsKey("dateOffre")) o.setDateOffre(asDate(patch.get("dateOffre")));
        Offre saved = offres.save(o);
        return new OffreDto(saved.getId(), saved.getNumeroOffre(), saved.getTypeMission(), saved.getStatut(), saved.getMontantHt(),
                saved.getDateOffre(), saved.getSite().getClient().getRaisonSociale(), saved.getSite().getNom());
    }

    @Transactional
    public CommandeDto updateCommande(Long id, Map<String, Object> patch) {
        AppUser actor = currentUserService.requireCurrentUser();
        forbidViewer(actor);
        Commande c = commandes.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Commande introuvable"));
        if (patch.containsKey("numeroCommande")) c.setNumeroCommande(required(asString(patch.get("numeroCommande")), "numeroCommande"));
        if (patch.containsKey("dateCommande")) c.setDateCommande(asDate(patch.get("dateCommande")));
        if (patch.containsKey("montantHt")) c.setMontantHt(nonNegative(asBigDecimal(patch.get("montantHt")), "montantHt"));
        if (patch.containsKey("montantFacture")) c.setMontantFacture(nonNegative(asBigDecimal(patch.get("montantFacture")), "montantFacture"));
        Commande saved = commandes.save(c);
        return new CommandeDto(saved.getId(), saved.getNumeroCommande(), saved.getDateCommande(), saved.getMontantHt(),
                saved.getMontantFacture(), saved.getOffre().getTypeMission(), saved.getOffre().getSite().getNom(),
                saved.getOffre().getSite().getClient().getRaisonSociale());
    }

    @Transactional
    public FactureDto updateFacture(Long id, Map<String, Object> patch) {
        AppUser actor = currentUserService.requireCurrentUser();
        forbidViewer(actor);
        Facture f = factures.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Facture introuvable"));
        if (patch.containsKey("numeroFacture")) f.setNumeroFacture(required(asString(patch.get("numeroFacture")), "numeroFacture"));
        if (patch.containsKey("numeroCommande")) {
            Commande cmd = commandes.findByNumeroCommandeIgnoreCase(required(asString(patch.get("numeroCommande")), "numeroCommande"))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Commande introuvable"));
            f.setCommande(cmd);
        }
        if (patch.containsKey("dateFacture")) f.setDateFacture(asDate(patch.get("dateFacture")));
        if (patch.containsKey("montantHt")) f.setMontantHt(nonNegative(asBigDecimal(patch.get("montantHt")), "montantHt"));
        if (patch.containsKey("frais")) f.setFrais(nonNegative(asBigDecimal(patch.get("frais")), "frais"));
        if (patch.containsKey("modeReglement")) f.setModeReglement(asString(patch.get("modeReglement")));
        Facture saved = factures.save(f);
        return new FactureDto(saved.getId(), saved.getNumeroFacture(), saved.getDateFacture(), saved.getCommande().getNumeroCommande(),
                saved.getCommande().getOffre().getSite().getClient().getRaisonSociale(), saved.getMontantHt(), saved.getFrais(),
                emptyOr(saved.getModeReglement()));
    }

    @Transactional
    public void deleteContact(Long id) {
        AppUser actor = currentUserService.requireCurrentUser();
        requireManagerOrAdmin(actor);
        contacts.delete(contacts.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contact introuvable")));
    }
    @Transactional
    public void deleteClient(Long id) {
        AppUser actor = currentUserService.requireCurrentUser();
        requireManagerOrAdmin(actor);
        clients.delete(clients.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Client introuvable")));
    }
    @Transactional
    public void deleteSite(Long id) {
        AppUser actor = currentUserService.requireCurrentUser();
        requireManagerOrAdmin(actor);
        sites.delete(sites.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Site introuvable")));
    }
    @Transactional
    public void deleteOffre(Long id) {
        AppUser actor = currentUserService.requireCurrentUser();
        requireManagerOrAdmin(actor);
        offres.delete(offres.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Offre introuvable")));
    }
    @Transactional
    public void deleteCommande(Long id) {
        AppUser actor = currentUserService.requireCurrentUser();
        requireManagerOrAdmin(actor);
        commandes.delete(commandes.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Commande introuvable")));
    }
    @Transactional
    public void deleteFacture(Long id) {
        AppUser actor = currentUserService.requireCurrentUser();
        requireManagerOrAdmin(actor);
        factures.delete(factures.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Facture introuvable")));
    }

    @Transactional
    public OffreDto duplicateOffre(Long id) {
        AppUser actor = currentUserService.requireCurrentUser();
        forbidViewer(actor);
        Offre src = offres.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Offre introuvable"));
        Offre clone = new Offre();
        clone.setSite(src.getSite());
        clone.setTypeMission(src.getTypeMission());
        clone.setStatut("PISTE");
        clone.setDateOffre(LocalDate.now());
        clone.setMontantHt(src.getMontantHt());
        clone.setConsultant(actor);
        clone.setNumeroOffre(nextOffreDuplicateNumero(src.getNumeroOffre()));
        Offre saved = offres.save(clone);
        trackDuplication("OFFRE", src.getId(), saved.getId(), src.getNumeroOffre(), saved.getNumeroOffre());
        return new OffreDto(saved.getId(), saved.getNumeroOffre(), saved.getTypeMission(), saved.getStatut(), saved.getMontantHt(),
                saved.getDateOffre(), saved.getSite().getClient().getRaisonSociale(), saved.getSite().getNom());
    }

    @Transactional
    public CommandeDto duplicateCommande(Long id) {
        AppUser actor = currentUserService.requireCurrentUser();
        forbidViewer(actor);
        Commande src = commandes.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Commande introuvable"));
        Commande clone = new Commande();
        clone.setOffre(src.getOffre());
        clone.setDateCommande(LocalDate.now());
        clone.setMontantHt(src.getMontantHt());
        clone.setMontantFacture(BigDecimal.ZERO);
        clone.setNumeroCommande(nextCommandeRef(src.getNumeroCommande()));
        Commande saved = commandes.save(clone);
        trackDuplication("COMMANDE", src.getId(), saved.getId(), src.getNumeroCommande(), saved.getNumeroCommande());
        return new CommandeDto(saved.getId(), saved.getNumeroCommande(), saved.getDateCommande(), saved.getMontantHt(),
                saved.getMontantFacture(), saved.getOffre().getTypeMission(), saved.getOffre().getSite().getNom(),
                saved.getOffre().getSite().getClient().getRaisonSociale());
    }

    @Transactional
    public void cancelOffre(Long id, CancelRequest request) {
        AppUser actor = currentUserService.requireCurrentUser();
        forbidViewer(actor);
        Offre offre = offres.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Offre introuvable"));
        HistoriqueAnnulation h = new HistoriqueAnnulation();
        h.setEntityType("OFFRE");
        h.setEntityId(offre.getId());
        h.setReference(offre.getNumeroOffre());
        h.setSnapshotJson("{\"numeroOffre\":\"" + offre.getNumeroOffre() + "\"}");
        h.setMotif(request.motif());
        h.setCommentaire(request.commentaire());
        h.setMontantHt(offre.getMontantHt());
        h.setClientNom(offre.getSite().getClient().getRaisonSociale());
        h.setConsultantCode(actor.getEmail());
        historiqueAnnulations.save(h);
        offres.delete(offre);
    }

    @Transactional
    public void cancelCommande(Long id, CancelRequest request) {
        AppUser actor = currentUserService.requireCurrentUser();
        requireManagerOrAdmin(actor);
        Commande cmd = commandes.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Commande introuvable"));
        HistoriqueAnnulation h = new HistoriqueAnnulation();
        h.setEntityType("COMMANDE");
        h.setEntityId(cmd.getId());
        h.setReference(cmd.getNumeroCommande());
        h.setSnapshotJson("{\"numeroCommande\":\"" + cmd.getNumeroCommande() + "\"}");
        h.setMotif(request.motif());
        h.setCommentaire(request.commentaire());
        h.setMontantHt(cmd.getMontantHt());
        h.setClientNom(cmd.getOffre().getSite().getClient().getRaisonSociale());
        h.setConsultantCode(actor.getEmail());
        historiqueAnnulations.save(h);
        commandes.delete(cmd);
    }

    @Transactional(readOnly = true)
    public List<HistoryItemDto> historyAnnulations(String type) {
        List<HistoriqueAnnulation> src = (type == null || type.isBlank())
                ? historiqueAnnulations.findTop200ByOrderByCancelledAtDesc()
                : historiqueAnnulations.findTop200ByEntityTypeOrderByCancelledAtDesc(type.toUpperCase());
        return src.stream().map(h -> new HistoryItemDto(
                h.getId(), h.getEntityType(), h.getEntityId(), h.getReference(), h.getMotif(), h.getCommentaire(),
                h.getMontantHt(), h.getClientNom(), h.getCancelledAt())).toList();
    }

    @Transactional(readOnly = true)
    public List<DuplicationItemDto> historyDuplications() {
        return historiqueDuplications.findTop200ByOrderByCreatedAtDesc().stream()
                .map(d -> new DuplicationItemDto(d.getId(), d.getEntityType(), d.getSourceId(), d.getTargetId(),
                        d.getSourceRef(), d.getTargetRef(), d.getCreatedAt()))
                .toList();
    }

    @Transactional
    public void saveRepartition(Long factureId, RepartitionRequest request) {
        AppUser actor = currentUserService.requireCurrentUser();
        forbidViewer(actor);
        Facture facture = factures.findById(factureId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Facture introuvable"));
        BigDecimal total = request.items().stream().map(RepartitionItemDto::pourcentage).reduce(BigDecimal.ZERO, BigDecimal::add);
        if (total.subtract(new BigDecimal("100.00")).abs().compareTo(new BigDecimal("0.001")) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La repartition doit totaliser 100%");
        }
        repartitions.deleteByFacture(facture);
        for (RepartitionItemDto i : request.items()) {
            RepartitionHonoraire rh = new RepartitionHonoraire();
            rh.setFacture(facture);
            rh.setCodePoste(i.codePoste());
            rh.setPourcentage(i.pourcentage());
            repartitions.save(rh);
        }
    }

    private void trackDuplication(String type, Long sourceId, Long targetId, String sourceRef, String targetRef) {
        HistoriqueDuplication d = new HistoriqueDuplication();
        d.setEntityType(type);
        d.setSourceId(sourceId);
        d.setTargetId(targetId);
        d.setSourceRef(sourceRef);
        d.setTargetRef(targetRef);
        historiqueDuplications.save(d);
    }

    /**
     * Duplication d’offre : même racine + suffixe A, B, C… collé après le dernier chiffre
     * (ex. LVO-MS-26002 → LVO-MS-26002A, puis LVO-MS-26002B si A existe).
     */
    private String nextOffreDuplicateNumero(String sourceNumero) {
        String root = rootOffreNumero(sourceNumero);
        Set<String> taken = new HashSet<>();
        for (Offre o : offres.findAll()) {
            if (o.getNumeroOffre() != null) {
                taken.add(o.getNumeroOffre().toUpperCase(Locale.ROOT));
            }
        }
        for (char c = 'A'; c <= 'Z'; c++) {
            String candidate = root + c;
            if (!taken.contains(candidate.toUpperCase(Locale.ROOT))) {
                return candidate;
            }
        }
        return root + "-X" + Instant.now().toEpochMilli();
    }

    private static String rootOffreNumero(String ref) {
        if (ref == null || ref.isBlank()) {
            return "OFF-" + Instant.now().toEpochMilli();
        }
        String cleaned = ref.replaceAll("(?i)-COPY$", "").trim();
        if (cleaned.matches("^.+\\d[A-Z]$")) {
            return cleaned.substring(0, cleaned.length() - 1);
        }
        return cleaned;
    }

    private String nextCommandeRef(String source) {
        return (source == null || source.isBlank() ? "CMD" : source) + "-R";
    }

    private Client requireClient(String clientNom) {
        return clients.findByRaisonSocialeIgnoreCase(trim(clientNom))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Client introuvable"));
    }

    private Site requireSite(String siteNom, String clientNom) {
        return sites.findByNomAndClientName(trim(siteNom), trim(clientNom)).stream()
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Site introuvable pour ce client"));
    }

    private Offre findOpenOffreBySite(Long siteId, String mission) {
        return offres.findAllActiveFetched().stream()
                .filter(o -> o.getSite().getId().equals(siteId))
                .filter(o -> mission == null || mission.isBlank() || mission.equalsIgnoreCase(o.getTypeMission()))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "Aucune offre active correspondante. Créez d'abord une offre."));
    }

    private static String trim(String v) {
        return v == null ? null : v.trim();
    }

    private static String emptyOr(String s) {
        return s == null || s.isBlank() ? "—" : s;
    }

    private static BigDecimal nonNegative(BigDecimal value, String field) {
        if (value == null || value.compareTo(BigDecimal.ZERO) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Valeur invalide pour " + field);
        }
        return value;
    }

    private static String asString(Object raw) {
        return raw == null ? null : raw.toString().trim();
    }

    private static BigDecimal asBigDecimal(Object raw) {
        if (raw == null) return null;
        try {
            return new BigDecimal(raw.toString().trim());
        } catch (RuntimeException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nombre invalide");
        }
    }

    private static LocalDate asDate(Object raw) {
        if (raw == null || raw.toString().isBlank()) return null;
        try {
            return LocalDate.parse(raw.toString());
        } catch (RuntimeException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Date invalide (format attendu: yyyy-MM-dd)");
        }
    }

    private static String required(String value, String field) {
        if (value == null || value.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Champ requis: " + field);
        return value;
    }

    private void forbidViewer(AppUser actor) {
        if (currentUserService.hasRole(actor, "VIEWER")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Role VIEWER cannot modify data");
        }
    }

    private void requireManagerOrAdmin(AppUser actor) {
        if (!currentUserService.hasAnyRole(actor, "MANAGER", "ADMIN")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Action requires MANAGER or ADMIN");
        }
    }
}
