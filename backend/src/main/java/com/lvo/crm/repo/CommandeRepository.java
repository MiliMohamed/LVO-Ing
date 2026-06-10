package com.lvo.crm.repo;

import com.lvo.crm.domain.Commande;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface CommandeRepository extends JpaRepository<Commande, Long> {

    long countByCancelledAtIsNull();

    @Query("select c from Commande c join fetch c.offre o join fetch o.site s join fetch s.client where c.cancelledAt is null order by c.dateCommande desc, c.id desc")
    List<Commande> findAllActiveFetched();

    Optional<Commande> findByNumeroCommandeIgnoreCase(String numeroCommande);
}
