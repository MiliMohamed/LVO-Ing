package com.lvo.crm.repo;

import com.lvo.crm.domain.Facture;
import com.lvo.crm.domain.RepartitionHonoraire;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RepartitionHonoraireRepository extends JpaRepository<RepartitionHonoraire, Long> {
    List<RepartitionHonoraire> findByFacture(Facture facture);
    void deleteByFacture(Facture facture);
}
