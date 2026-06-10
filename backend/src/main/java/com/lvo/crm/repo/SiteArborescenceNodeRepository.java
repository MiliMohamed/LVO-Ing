package com.lvo.crm.repo;

import com.lvo.crm.domain.SiteArborescenceNode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SiteArborescenceNodeRepository extends JpaRepository<SiteArborescenceNode, Long> {

    boolean existsBySiteId(Long siteId);

    @Query(
            """
            select n from SiteArborescenceNode n
            where n.site.id = :siteId and (
                (:parentId is null and n.parent is null) or (n.parent.id = :parentId)
            )
            order by n.sortOrder asc, n.nom asc
            """)
    List<SiteArborescenceNode> findChildren(
            @Param("siteId") Long siteId, @Param("parentId") Long parentId);

    @Query("select n from SiteArborescenceNode n where n.site.id = :siteId order by n.sortOrder asc, n.nom asc")
    List<SiteArborescenceNode> findAllBySiteId(@Param("siteId") Long siteId);

    Optional<SiteArborescenceNode> findByIdAndSiteId(Long id, Long siteId);
}
