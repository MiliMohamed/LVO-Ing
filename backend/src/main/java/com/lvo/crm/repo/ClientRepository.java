package com.lvo.crm.repo;

import com.lvo.crm.domain.Client;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ClientRepository extends JpaRepository<Client, Long> {
    Optional<Client> findByRaisonSocialeIgnoreCase(String raisonSociale);
}
