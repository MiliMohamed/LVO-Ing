package com.lvo.crm.repo;

import com.lvo.crm.domain.HistoriqueDuplication;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface HistoriqueDuplicationRepository extends JpaRepository<HistoriqueDuplication, Long> {
    List<HistoriqueDuplication> findTop200ByOrderByCreatedAtDesc();
}
