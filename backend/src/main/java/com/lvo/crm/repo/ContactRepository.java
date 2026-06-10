package com.lvo.crm.repo;

import com.lvo.crm.domain.Contact;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface ContactRepository extends JpaRepository<Contact, Long> {

    @Query("select c from Contact c join fetch c.client order by c.nom, c.prenom")
    List<Contact> findAllFetched();
}
