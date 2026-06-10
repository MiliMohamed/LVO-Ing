package com.lvo.crm.api;

import com.lvo.crm.api.dto.*;
import com.lvo.crm.service.CrmReadService;
import com.lvo.crm.service.CrmWriteService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class CrmApiController {

    private final CrmReadService crmReadService;
    private final CrmWriteService crmWriteService;

    public CrmApiController(CrmReadService crmReadService, CrmWriteService crmWriteService) {
        this.crmReadService = crmReadService;
        this.crmWriteService = crmWriteService;
    }

    @GetMapping("/dashboard/counts")
    public DashboardCounts counts() {
        return crmReadService.dashboardCounts();
    }

    @GetMapping("/contacts")
    public List<ContactDto> contacts() {
        return crmReadService.contacts();
    }

    @PostMapping("/contacts")
    public ContactDto createContact(@RequestBody @Valid CreateContactRequest request) {
        return crmWriteService.createContact(request);
    }

    @PutMapping("/contacts/{id}")
    public ContactDto updateContact(@PathVariable Long id, @RequestBody Map<String, Object> patch) {
        return crmWriteService.updateContact(id, patch);
    }

    @DeleteMapping("/contacts/{id}")
    public void deleteContact(@PathVariable Long id) {
        crmWriteService.deleteContact(id);
    }

    @GetMapping("/clients")
    public List<ClientDto> clients() {
        return crmReadService.clients();
    }

    @PostMapping("/clients")
    public ClientDto createClient(@RequestBody @Valid CreateClientRequest request) {
        return crmWriteService.createClient(request);
    }

    @PutMapping("/clients/{id}")
    public ClientDto updateClient(@PathVariable Long id, @RequestBody Map<String, Object> patch) {
        return crmWriteService.updateClient(id, patch);
    }

    @DeleteMapping("/clients/{id}")
    public void deleteClient(@PathVariable Long id) {
        crmWriteService.deleteClient(id);
    }

    @GetMapping("/sites")
    public List<SiteDto> sites() {
        return crmReadService.sites();
    }

    @PostMapping("/sites")
    public SiteDto createSite(@RequestBody @Valid CreateSiteRequest request) {
        return crmWriteService.createSite(request);
    }

    @PutMapping("/sites/{id}")
    public SiteDto updateSite(@PathVariable Long id, @RequestBody Map<String, Object> patch) {
        return crmWriteService.updateSite(id, patch);
    }

    @DeleteMapping("/sites/{id}")
    public void deleteSite(@PathVariable Long id) {
        crmWriteService.deleteSite(id);
    }

    @GetMapping("/offres")
    public List<OffreDto> offres() {
        return crmReadService.offresActives();
    }

    @PostMapping("/offres")
    public OffreDto createOffre(@RequestBody @Valid CreateOffreRequest request) {
        return crmWriteService.createOffre(request);
    }

    @PutMapping("/offres/{id}")
    public OffreDto updateOffre(@PathVariable Long id, @RequestBody Map<String, Object> patch) {
        return crmWriteService.updateOffre(id, patch);
    }

    @DeleteMapping("/offres/{id}")
    public void deleteOffre(@PathVariable Long id) {
        crmWriteService.deleteOffre(id);
    }

    @PostMapping("/offres/{id}/duplicate")
    public OffreDto duplicateOffre(@PathVariable Long id) {
        return crmWriteService.duplicateOffre(id);
    }

    @PostMapping("/offres/{id}/cancel")
    public void cancelOffre(@PathVariable Long id, @RequestBody @Valid CancelRequest request) {
        crmWriteService.cancelOffre(id, request);
    }

    @GetMapping("/commandes")
    public List<CommandeDto> commandes() {
        return crmReadService.commandesActives();
    }

    @PostMapping("/commandes")
    public CommandeDto createCommande(@RequestBody @Valid CreateCommandeRequest request) {
        return crmWriteService.createCommande(request);
    }

    @PutMapping("/commandes/{id}")
    public CommandeDto updateCommande(@PathVariable Long id, @RequestBody Map<String, Object> patch) {
        return crmWriteService.updateCommande(id, patch);
    }

    @DeleteMapping("/commandes/{id}")
    public void deleteCommande(@PathVariable Long id) {
        crmWriteService.deleteCommande(id);
    }

    @PostMapping("/commandes/{id}/duplicate")
    public CommandeDto duplicateCommande(@PathVariable Long id) {
        return crmWriteService.duplicateCommande(id);
    }

    @PostMapping("/commandes/{id}/cancel")
    public void cancelCommande(@PathVariable Long id, @RequestBody @Valid CancelRequest request) {
        crmWriteService.cancelCommande(id, request);
    }

    @GetMapping("/factures")
    public List<FactureDto> factures() {
        return crmReadService.factures();
    }

    @PostMapping("/factures")
    public FactureDto createFacture(@RequestBody @Valid CreateFactureRequest request) {
        return crmWriteService.createFacture(request);
    }

    @PutMapping("/factures/{id}")
    public FactureDto updateFacture(@PathVariable Long id, @RequestBody Map<String, Object> patch) {
        return crmWriteService.updateFacture(id, patch);
    }

    @DeleteMapping("/factures/{id}")
    public void deleteFacture(@PathVariable Long id) {
        crmWriteService.deleteFacture(id);
    }

    @PostMapping("/factures/{id}/repartition")
    public void repartition(@PathVariable Long id, @RequestBody @Valid RepartitionRequest request) {
        crmWriteService.saveRepartition(id, request);
    }

    @GetMapping("/historique/annulations")
    public List<HistoryItemDto> historyAnnulations() {
        return crmWriteService.historyAnnulations(null);
    }

    @GetMapping("/historique/annulations/{type}")
    public List<HistoryItemDto> historyAnnulationsByType(@PathVariable String type) {
        return crmWriteService.historyAnnulations(type);
    }

    @GetMapping("/historique/duplications")
    public List<DuplicationItemDto> historyDuplications() {
        return crmWriteService.historyDuplications();
    }
}
