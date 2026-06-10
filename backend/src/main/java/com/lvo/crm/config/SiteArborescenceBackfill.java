package com.lvo.crm.config;

import com.lvo.crm.domain.Site;
import com.lvo.crm.repo.SiteArborescenceNodeRepository;
import com.lvo.crm.repo.SiteRepository;
import com.lvo.crm.service.SiteArborescenceService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * Crée l'arborescence interne pour les sites existants qui n'en ont pas encore.
 */
@Component
public class SiteArborescenceBackfill implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SiteArborescenceBackfill.class);

    private final SiteRepository sites;
    private final SiteArborescenceNodeRepository nodes;
    private final SiteArborescenceService arborescenceService;

    public SiteArborescenceBackfill(
            SiteRepository sites,
            SiteArborescenceNodeRepository nodes,
            SiteArborescenceService arborescenceService) {
        this.sites = sites;
        this.nodes = nodes;
        this.arborescenceService = arborescenceService;
    }

    @Override
    public void run(ApplicationArguments args) {
        int created = 0;
        for (Site site : sites.findAll()) {
            if (!nodes.existsBySiteId(site.getId())) {
                arborescenceService.provisionSiteTree(site);
                created++;
            }
        }
        if (created > 0) {
            log.info("Arborescence interne rétro-provisionnée pour {} site(s)", created);
        }
    }
}
