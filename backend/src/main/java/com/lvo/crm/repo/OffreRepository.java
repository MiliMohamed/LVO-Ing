package com.lvo.crm.repo;

import com.lvo.crm.domain.Offre;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface OffreRepository extends JpaRepository<Offre, Long> {

    long countByCancelledAtIsNull();

    @Query("select o from Offre o join fetch o.site s join fetch s.client where o.cancelledAt is null order by o.dateOffre desc nulls last, o.id desc")
    List<Offre> findAllActiveFetched();

    Optional<Offre> findByNumeroOffreIgnoreCase(String numeroOffre);
}
