package com.lvo.crm.repo;

import com.lvo.crm.domain.Site;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SiteRepository extends JpaRepository<Site, Long> {

    @Query("select s from Site s join fetch s.client order by s.nom")
    List<Site> findAllFetched();

    @Query("select s from Site s join fetch s.client c where lower(s.nom) = lower(:nom) and lower(c.raisonSociale) = lower(:raisonSociale)")
    List<Site> findByNomAndClientName(@Param("nom") String nom, @Param("raisonSociale") String raisonSociale);
}
