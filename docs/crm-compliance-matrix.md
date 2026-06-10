# CRM Compliance Matrix (PDF v4.0 vs Current App)

| Area | Requirement (PDF) | Current State | Status | Priority |
|---|---|---|---|---|
| Auth | JWT + refresh tokens | Access token only | Partial | P0 |
| Auth | 4 roles (ADMIN/MANAGER/CONSULTANT/VIEWER) | ADMIN/CONSULTANT | Partial | P0 |
| RBAC | Role matrix per action + agency scope | Global access for authenticated users | KO | P0 |
| Contacts/Clients | CRUD incl. delete constraints | Implemented | OK | P1 |
| Sites | CRUD | Implemented | OK | P1 |
| Offres/Commandes | Annulation avec motif + historique | Missing | KO | P0 |
| Offres/Commandes | Duplication workflows | Missing | KO | P0 |
| Historique | Annulations/duplications pages + relance | Placeholder UI | KO | P0 |
| Facturation | Honoraires repartition = 100% | Missing | KO | P0 |
| Facturation | Reste a facturer, statuts paiement | Partial | Partial | P1 |
| Planning | Echeancier + alerting | Basic table only | KO | P1 |
| Upload | File upload linked to entities | Upload local + UI catégorie / lien / quota ; presign stub ; MinIO compose | Partial | P1 |
| Documents | PDF/Word generation | Génération offre/commande/facture + téléchargement blob ; versions stub | Partial | P1 |
| Emails | Templates + send + attachments | Modèles OFFRE/FACTURE/RELANCE/INVITATION + file mock | Partial | P1 |
| Reports | 6 tabs with exports | 6 onglets + KPI API ; exports CSV KPI/annulations ; onglet annulations synchronisé API | Partial | P1 |
| RGPD | Export/anonymization endpoints | Export + anonymize + politiques rétention API ; UI hub MANAGER+ | Partial | P2 |
| RBAC | Matrix par rôle | Spring : VIEWER GET-only ; RGPD MANAGER+/ADMIN ; sidebar masque zones interdites | Partial | P0 |
| Planning | Échéancier + alertes | Page jalons + API `/api/planning/jalons` stub | Partial | P1 |

## Delivery sequence

1. Security/RBAC/refresh/rate-limit.
2. Cancellation + duplication + history + relaunch.
3. Facturation rules + status and receivables fields.
4. Upload + document generation + messaging templates.
5. Reports v2 (6 tabs) + planning + RGPD endpoints.
