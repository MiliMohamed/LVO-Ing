package com.lvo.crm.repo;

import com.lvo.crm.domain.Facture;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface FactureRepository extends JpaRepository<Facture, Long> {

    @Query(
            "select f from Facture f join fetch f.commande cm join fetch cm.offre ov join fetch ov.site si join fetch si.client order by f.dateFacture desc, f.id desc")
    List<Facture> findAllFetched();
}
