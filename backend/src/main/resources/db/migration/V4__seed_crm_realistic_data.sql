-- Jeu de données réaliste pour tests CRM complets

INSERT INTO clients (raison_sociale, siret, type_client, email, telephone, entite)
VALUES ('EDF SEI Réunion', '55208131766522', 'Public', 'marches-sei-reunion@edf.fr', '+262 262 46 51 00', 'Direction Technique'),
       ('SHLMR', '31086317000019', 'Bailleur', 'service-technique@shlmr.re', '+262 262 20 21 22', 'Patrimoine'),
       ('Rectorat de La Réunion', '17974005500019', 'Public', 'mopa@ac-reunion.fr', '+262 262 48 10 10', 'Service Immobilier')
ON CONFLICT DO NOTHING;

INSERT INTO contacts (client_id, civilite, nom, prenom, fonction, email, telephone, mobile, plateforme)
SELECT c.id,
       v.civilite,
       v.nom,
       v.prenom,
       v.fonction,
       v.email,
       v.telephone,
       v.mobile,
       FALSE
FROM (VALUES ('EDF SEI Réunion', 'Mme', 'DUPONT', 'Claire', 'Responsable maintenance', 'claire.dupont@edf.fr',
              '+262 262 46 51 45', '+262 692 45 11 22'),
             ('SHLMR', 'M.', 'PAYET', 'Jean-Michel', 'Chargé d''opérations', 'jm.payet@shlmr.re',
              '+262 262 20 21 90', '+262 692 02 15 34'),
             ('Rectorat de La Réunion', 'Mme', 'HOARAU', 'Sophie', 'Ingénieure patrimoine',
              'sophie.hoarau@ac-reunion.fr', '+262 262 48 11 55', '+262 692 76 00 44')) AS v(client_nom, civilite, nom,
                                                                                              prenom, fonction, email,
                                                                                              telephone, mobile)
         JOIN clients c ON c.raison_sociale = v.client_nom
WHERE NOT EXISTS (SELECT 1
                  FROM contacts x
                  WHERE x.client_id = c.id
                    AND lower(x.nom) = lower(v.nom)
                    AND lower(x.prenom) = lower(v.prenom));

INSERT INTO sites (client_id, consultant_id, nom, adresse, type_site)
SELECT c.id,
       u.id,
       v.nom,
       v.adresse,
       v.type_site
FROM (VALUES ('EDF SEI Réunion', 'Centrale thermique du Port', 'Zone Industrielle n°2, Le Port', 'Industriel'),
             ('SHLMR', 'Résidence Bois de Nèfles', 'Chemin Bois de Nèfles, Saint-Denis', 'Résidentiel'),
             ('Rectorat de La Réunion', 'Lycée Bellepierre', 'Avenue Gaston Monnerville, Saint-Denis', 'Éducation'))
         AS v(client_nom, nom, adresse, type_site)
         JOIN clients c ON c.raison_sociale = v.client_nom
         LEFT JOIN users u ON lower(u.email) = 'consultant@lvo-ing.fr'
WHERE NOT EXISTS (SELECT 1 FROM sites s WHERE lower(s.nom) = lower(v.nom));

INSERT INTO offres (site_id, consultant_id, numero_offre, type_mission, statut, montant_ht, date_offre)
SELECT s.id,
       u.id,
       v.numero_offre,
       v.type_mission,
       v.statut,
       v.montant_ht::numeric(14, 2),
       v.date_offre::date
FROM (VALUES ('Centrale thermique du Port', '2026-MS-974-101', 'MS', 'ENVOYEE', 48250.00, '2026-04-10'),
             ('Résidence Bois de Nèfles', '2026-MCM-974-115', 'MCM', 'COMMANDE', 22900.00, '2026-03-22'),
             ('Lycée Bellepierre', '2026-ET-974-123', 'ET', 'ENVOYEE', 15800.00, '2026-04-02'))
         AS v(site_nom, numero_offre, type_mission, statut, montant_ht, date_offre)
         JOIN sites s ON s.nom = v.site_nom
         LEFT JOIN users u ON lower(u.email) = 'consultant@lvo-ing.fr'
WHERE NOT EXISTS (SELECT 1 FROM offres o WHERE lower(o.numero_offre) = lower(v.numero_offre));

INSERT INTO commandes (offre_id, numero_commande, date_commande, montant_ht, montant_facture)
SELECT o.id,
       v.numero_commande,
       v.date_commande::date,
       v.montant_ht::numeric(14, 2),
       v.montant_facture::numeric(14, 2)
FROM (VALUES ('2026-MCM-974-115', 'BC-2026-0419', '2026-03-28', 22900.00, 12200.00),
             ('2026-MS-94-89-051', 'BC-2026-0312', '2026-03-10', 26041.00, 8670.00))
         AS v(numero_offre, numero_commande, date_commande, montant_ht, montant_facture)
         JOIN offres o ON o.numero_offre = v.numero_offre
WHERE NOT EXISTS (SELECT 1 FROM commandes c WHERE lower(c.numero_commande) = lower(v.numero_commande))
  AND NOT EXISTS (SELECT 1 FROM commandes c2 WHERE c2.offre_id = o.id);

INSERT INTO factures (commande_id, numero_facture, montant_ht, frais, statut, mode_reglement, date_facture)
SELECT c.id,
       v.numero_facture,
       v.montant_ht::numeric(14, 2),
       v.frais::numeric(14, 2),
       'EMISE',
       v.mode_reglement,
       v.date_facture::date
FROM (VALUES ('BC-2026-0419', 'FAC-2026-0058', 12200.00, 305.00, 'VIREMENT', '2026-04-12'),
             ('BC-2026-0312', 'FAC-2026-0041', 8670.00, 180.00, 'VIREMENT', '2026-03-29'))
         AS v(numero_commande, numero_facture, montant_ht, frais, mode_reglement, date_facture)
         JOIN commandes c ON c.numero_commande = v.numero_commande
WHERE NOT EXISTS (SELECT 1 FROM factures f WHERE lower(f.numero_facture) = lower(v.numero_facture));
