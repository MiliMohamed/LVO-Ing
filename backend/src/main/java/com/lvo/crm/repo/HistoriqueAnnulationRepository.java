package com.lvo.crm.repo;

import com.lvo.crm.domain.HistoriqueAnnulation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface HistoriqueAnnulationRepository extends JpaRepository<HistoriqueAnnulation, Long> {
    List<HistoriqueAnnulation> findTop200ByEntityTypeOrderByCancelledAtDesc(String entityType);
    List<HistoriqueAnnulation> findTop200ByOrderByCancelledAtDesc();
}
