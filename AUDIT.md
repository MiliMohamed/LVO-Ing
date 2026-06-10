# AUDIT CRM LVO — Phase 0

**Date** : mai 2026  
**Périmètre** : dépôt `lvo-web` tel qu’ouvert dans Cursor (audit statique du code source).  
**Référence** : `docs/PLAN_ALIGNEMENT_CRM_LVO.md` (exigences R1–R12 + phases).

---

## 1. Contexte

| Élément | Constat |
|--------|---------|
| **Code présent** | Application **Next.js** sous `frontend/` (React 18, App Router). |
| **Backend dans ce dépôt** | **API de démo** sous `server/` (Express, JWT, données en mémoire) ; schéma cible **Prisma** sous `prisma/`. |
| **API métier** | Le front appelle `NEXT_PUBLIC_API_URL` ou défaut `http://localhost:8080` (`frontend/lib/config.ts`). |
| **Limite de l’audit** | Les routes mémoire peuvent diverger du schéma Prisma tant que la persistance n’est pas branchée. |

---

## 2. Inventaire des modules présents (frontend)

| Domaine | Fichier(s) / route principale | Rôle |
|--------|--------------------------------|------|
| Auth JWT + refresh | `frontend/lib/api.ts`, `frontend/lib/token-storage.ts`, `frontend/app/login/page.tsx` | Login, refresh token, session locale. |
| RBAC | `frontend/lib/rbac.ts` | Rôles ADMIN, MANAGER, CONSULTANT, VIEWER ; matrice documentée vers `docs/crm-compliance-matrix.md`. |
| Shell CRM | `frontend/components/crm/CrmShell.tsx` | Layout, sidebar, compteurs dashboard. |
| Listes + CRUD générique | `frontend/components/crm/CrmTablePage.tsx`, `CancelCommandeModal.tsx`, `Phase5EntitySheet.tsx` | Offres/commandes/factures : flux historique ; commandes : modal annulation ; **contacts/clients/sites** : fiche Phase 5 ; sites : filtre Phase 6. |
| Sites + R3 | `frontend/app/crm/sites/page.tsx`, `SiteGestionnairesPanel.tsx`, `Phase5EntitySheet.tsx` | Liste avec filtre gestionnaire ; fiche : gestionnaires, promouvoir, clôture. |
| Journal d’audit (ADMIN) | `frontend/app/crm/outils/audit/page.tsx`, `AuditLogClient.tsx` | `GET /api/audit-log` + export CSV. |
| Formulaires création | `frontend/components/crm/NouveauEntityForm.tsx`, `frontend/app/crm/nouveau/[slug]/page.tsx` | Contact, client, site, offre, commande, facture ; **phases** = `localStorage` uniquement. |
| Dashboard | `frontend/components/crm/DashboardClient.tsx`, `frontend/app/crm/dashboard/page.tsx` | Compteurs + aperçu offres. |
| Pages liste | `frontend/app/crm/contacts/page.tsx`, `clients`, `sites`, `offres`, `commandes`, `factures` | Tables branchées sur `/api/...`. |
| Historique annulations | `frontend/app/crm/historique/[type]/page.tsx` | Filtre OFFRE / COMMANDE. |
| Rapports | `frontend/components/crm/RapportsClient.tsx` | KPIs API, top gestionnaires (Phase 6), exports CSV ; autres graphiques démo. |
| Documents PDF/Word | `frontend/app/crm/outils/documents/page.tsx` | Génération blob + liste versions par référence (message UI : versioning S3/MinIO « à brancher »). |
| Upload | `frontend/app/crm/outils/upload/page.tsx` | Presign + upload. |
| Emails | `frontend/app/crm/outils/emails/page.tsx` | Envoi via API. |
| Planning | `frontend/app/crm/outils/planning/page.tsx` | Jalons. |
| RGPD | `frontend/app/crm/outils/rgpd/page.tsx` | Politiques, export, anonymisation. |
| Site vitrine | `frontend/components/site/*`, `frontend/app/page.tsx` | Hors périmètre CRM métier. |

---

## 3. Inventaire des modules / capacités **manquants** ou **non vérifiables** (vs plan R1–R12)

Les écarts ci-dessous sont mesurés par rapport au plan d’alignement et à la fiche technique **telle que résumée** dans `docs/PLAN_ALIGNEMENT_CRM_LVO.md`. Une coche « absent du front » ne signifie pas que l’API ne le fait pas — seulement qu’**il n’y a pas d’UI ni de types dédiés visibles** dans ce dépôt.

| ID plan | Exigence | Constat dans `lvo-web` | Priorité suggérée |
|---------|----------|------------------------|-------------------|
| **R1** | Recouvrement + Quonto + relances + icône sidebar | **Partiel** : page `/crm/recouvrement`, KPIs + actions relance/rapprochement ; Quonto sync/webhook côté API démo sans OAuth réel ni cron. | **P0** |
| **R2** | Liaison compte bancaire / vérification paiements | **Partiel** : rapprochement manuel + webhook stub ; pas de compte bancaire « live ». | **P0** |
| **R3** | Site géré par un autre client (multi-gestionnaires) | **Partiel (Phase 6)** : `siteGestionnaires` en mémoire, fiche site (`SiteGestionnairesPanel`), filtre liste, offres avec destinataire propriétaire/gestionnaires, rapport top CA. Alignement Prisma `site_gestionnaires` à la persistance. | **P1** |
| **R4** | Formats refs `LVO-MOE-26009`, `2026-LVO-MOE-006`, `LVO-F2026-001` | Champs libres `numeroOffre`, `numeroCommande`, `numeroFacture` saisis à la main ; exemple doc `2026-MS-001`. Pas de service de compteur atomique côté front. | **P0** |
| **R5** | Phases partielles / totales par mission | Config phases **locale** (`localStorage`) ; pas d’inclusion/exclusion par phase en BDD côté UI. | **P1** |
| **R6** | Avoirs sur annulation commande (factures émises) | **Partiel** : API `GET /commandes/:id/factures` + `POST .../cancel` (avoirs) ; UI `CancelCommandeModal` sur la liste commandes. PDF avoir encore stub côté serveur. | **P0** (reste PDF / persistance) |
| **R7** | Versioning fichiers + archive OneDrive | UI documents indique versioning « à brancher » ; pas d’intégration OneDrive dans le front. | **P1** |
| **R8** | N° commande **client** sur facture | Type `FactureRow` : `numeroCommande` (liaison commande) ; pas de champ explicite « commande client » séparé comme dans le plan (`numero_client`). | **P0** |
| **R9** | Tableaux échéancier facturation + exécution dans PDF offre | Pas de champs UI/API visibles pour `echeancier_*_json` dans les types front. | **P1** |
| **R10** | TVA 20% / 8,5% DOM-TOM + consultant par défaut | Non présent dans les formulaires/types observés. | **P2** |
| **R11** | Annulation contact / client (soft delete, statuts) | **API** `POST /contacts/:id/cancel|restore`, `POST /clients/:id/cancel` (règles blocage) ; pas d’UI dédiée dans le front au-delà du CRUD générique. | **P1** |
| **R12** | Suppression sans commande + règles + modification coordonnées | **Partiel (Phase 5)** : fiches contacts/clients/sites (`Phase5EntitySheet`), `PATCH` + `DELETE` avec garde-fous serveur ; audit mémoire + page `/crm/outils/audit` (ADMIN). Pas d’e-mail réel ni MFA ni table `adresses_history`. | **P1** |

---

## 4. Schéma de données (BDD)

**Schéma Prisma cible** : `prisma/schema.prisma` + migration initiale `prisma/migrations/20260510140000_lvo_alignment_v1/` (Phase 2 du plan : tables `reference_counters`, `avoirs`, `paiements`, `relances`, `site_gestionnaires`, `fichiers_versions`, colonnes R5–R11 sur entités existantes, index partiels Quonto / échéances, seed compteurs 2026).

**Écart avec le front actuel** : le frontend utilise encore des **ids numériques** et des libellés (`clientNom`, `siteNom`) ; le schéma Prisma introduit des **UUID** et des FK `client_id` / `site_id`. L’API existante devra soit migrer vers ce modèle, soit maintenir une couche de mapping.

**Modèle implicite (contrat UI historique)** — dérivé de `frontend/lib/types.ts` :

- Identifiants numériques (`number`) pour `Contact`, `Client`, `Site`, `Offre`, `Commande`, `Facture`.
- Offres / commandes : références texte, `typeMission`, montants, liaison par noms (`clientNom`, `siteNom`) plutôt que par UUID.
- Factures côté types front : pas encore `statut_paiement`, `montant_paye`, `numero_commande_client` (présents dans Prisma).

Le schéma Prisma couvre les structures listées dans le plan Phase 2 ; **l’API** doit les implémenter et synchroniser les DTO avec le front.

---

## 5. Endpoints API **consommés** par le frontend

Base : `{API_URL}/api/...` (JWT Bearer sauf login).

### Auth
- `POST /api/auth/login`
- `POST /api/auth/refresh`

### Tableaux de bord & métier
- `GET /api/dashboard/counts`
- `GET /api/contacts` — `POST` (VIEWER interdit) ; `PATCH` / `PUT` / `DELETE` avec règles Phase 5 (commandes liées, consultant assigné)
- `GET /api/clients` — idem ; suppression **ADMIN** uniquement si aucune commande / facture / site actif
- `GET /api/sites` — inclut `gestionnairePrincipal`, `gestionnairesActifs` (Phase 6)
- `GET /api/sites/meta/gestionnaires-filters` — noms pour filtre liste
- `GET /api/sites/{id}/gestionnaires` — historique liens site ↔ client gestionnaire
- `POST /api/sites/{id}/gestionnaires` — `clientNom`, `isPrincipal`, `notes` (VIEWER interdit)
- `PATCH /api/sites/{id}/gestionnaires/{gid}` — `dateFin`, `notes`, `isPrincipal`
- `DELETE /api/sites/{id}/gestionnaires/{gid}` — clôture (soft : `dateFin`)
- `POST /api/sites/{id}/gestionnaires/{gid}/promouvoir` — principal unique actif
- `GET /api/sites/{id}/offre-destinataires` — options client pour **nouvelle offre** (propriétaire + gestionnaires actifs)
- `GET /api/offres` — idem ; `POST .../duplicate`, `POST .../cancel`
- `GET /api/commandes` — idem ; `POST .../duplicate`, `POST .../cancel` (annulation simple ou avec `factureIds` + `emitAvoirs` pour création d’avoirs)
- `GET /api/commandes/{id}/factures` — factures liées (annulation / avoirs)
- `GET /api/factures` — idem (sans duplicate/cancel dans `CrmTablePage`)

### Annulations & avoirs (Phase 4)

- `GET /api/avoirs` — liste avoirs émis
- `GET /api/avoirs/{id}/pdf` — PDF stub
- `POST /api/contacts/{id}/cancel` — motif obligatoire (ADMIN/MANAGER) ; `POST .../restore` (ADMIN)
- `POST /api/clients/{id}/cancel` — ADMIN, motif implicite si absent

### Audit & conformité (Phase 5)

- `GET /api/audit-log` — réservé **ADMIN** (dernières entrées mémoire)
- `GET /api/audit-log/export.csv` — export CSV (ADMIN)

### Rapports & historique
- `GET /api/rapports/kpis` — métriques dont `avoirsEmis`, `avoirsMontantHt` (Phase 4) ; champs agrégés `totalOffres`, `totalCommandes`, `totalFactures` pour le front
- `GET /api/rapports/top-gestionnaires` — CA HT offres par client gestionnaire actif (Phase 6)
- `GET /api/rapports/export/kpis.csv`
- `GET /api/rapports/export/annulations.csv`
- `GET /api/historique/annulations`
- `GET /api/historique/annulations/OFFRE`
- `GET /api/historique/annulations/COMMANDE`

### Documents & fichiers
- `GET /api/documents/versions?reference=`
- `POST /api/documents/offre/generate`
- `POST /api/documents/commande/generate`
- `POST /api/documents/facture/generate`
- `POST /api/fichiers/presign`
- `POST /api/fichiers/upload` (corps non JSON — fetch dédié)

### Planning, emails, RGPD
- `GET /api/planning/jalons`
- `POST /api/emails/send`
- `GET /api/rgpd/politiques-retention`
- `GET /api/rgpd/export?email=`
- `POST /api/rgpd/anonymize?contactId=`

### Recouvrement & Quonto (Phase 3)

Implémentés dans **`server/`** (données mémoire + JWT). **Reste à produire** : OAuth Quonto, table `oauth_tokens`, cron relances, persistance Prisma.

- `GET /api/recouvrement/kpis`
- `GET /api/recouvrement/factures-impayees`
- `GET /api/recouvrement/transactions-en-attente`
- `POST /api/recouvrement/factures/{id}/relance`
- `POST /api/recouvrement/factures/{id}/payer-manuel`
- `POST /api/recouvrement/transactions/{id}/rapprocher`
- `POST /api/recouvrement/transactions/{id}/ignorer`
- `POST /api/quonto/sync-now`
- `POST /api/webhooks/quonto` (HMAC si `QUONTO_WEBHOOK_SECRET`, idempotence `transaction_id`)

---

## 6. Synthèse des écarts — priorité & ordre de travail recommandé

| Écart | Priorité | Fichiers / zone cible (quand le backend sera dans le même produit) | Estimation indicative |
|-------|----------|---------------------------------------------------------------------|------------------------|
| Référentiel R4 + compteurs atomiques | P0 | Service références + migration BDD + remplacer saisie manuelle dans `NouveauEntityForm` / validations | 5–10 j.h. |
| Avoirs + annulation commande (R6) | P0 | PDF avoir conforme + persistance Prisma ; compléter types front facture si besoin | 4–10 j.h. |
| Recouvrement + Quonto (R1–R2) | P0 | Module API + page `recouvrement` + `rbac` sidebar + cron relances | 15–25 j.h. |
| N° commande client facture (R8) | P0 | BDD `commandes.numero_client` + formulaire commande + template PDF | 3–6 j.h. |
| Multi-gestionnaires sites (R3) | P1 | Persistance Prisma + contraintes UUID ; édition dates fin dans fiche | 3–8 j.h. |
| Phases sélectionnables (R5) | P1 | BDD `phases_offre` + UI offre + PDF | 6–12 j.h. |
| OneDrive versioning (R7) | P1 | Jobs + `fichiers_versions` + UI versions | 10–20 j.h. |
| Échéanciers PDF offre (R9) | P1 | JSON + générateur PDF | 4–8 j.h. |
| Annulation / soft delete contact-client (R11–R12) | P1 | Persistance audit Prisma ; archives listes ; e-mail confirmation réel | 6–12 j.h. |
| TVA DOM + consultant défaut (R10) | P2 | Règles formulaire offre + seed consultant | 2–4 j.h. |

*(Les estimations supposent une équipe maîtrisant déjà la stack backend réelle.)*

---

## 7. Critères Phase 0 (checklist plan)

- [x] Les **12 exigences R1–R12** sont listées et commentées (section 3).
- [x] Chaque grand écart a une **priorité** et une **zone cible** (section 6).
- [x] Schéma Prisma : **`prisma/schema.prisma`** (section 4) — valider avec `npm run db:validate` après configuration de `DATABASE_URL` (voir `.env.example`).
- [x] Liste des endpoints **telle qu’utilisée par le front** (section 5).

---

## 8. API locale Express (Phase 3)

Un serveur de démo est disponible dans `server/` (`npm run api:dev` à la racine). Il expose l’auth JWT, le CRM, Recouvrement, Quonto, **Phase 4–5–6** (avoirs, audit R12, **sites multi-gestionnaires R3** en mémoire), et **Phase 7–10 (démo)** : référentiel phases offre, versions document stub + archivage OneDrive simulé, N° commande client / échéanciers JSON / TVA DOM sur offre, OCR & suggestion règles, e-signature stub, recherche globale `POST /api/search` + palette **⌘K**. Données **en mémoire** — à remplacer par Prisma + PostgreSQL en production.

Variables : voir `.env.example` (`JWT_SECRET`, `QUONTO_WEBHOOK_SECRET`, `API_PORT`, `NEXT_PUBLIC_API_URL`).

---

## 9. Prochaine étape recommandée

1. Lancer **`npm run api:dev`** (racine) et le front (`cd frontend && npm run dev`) avec **`NEXT_PUBLIC_API_URL=http://localhost:8080`**.  
2. **PostgreSQL + Prisma** : remplacer le store mémoire par le schéma `prisma/` (persist `paiements`, `relances`, factures, `phases_offre`, `fichiers_versions`, etc.).  
3. Remplacer les **stubs** Phase 8–10 (OneDrive, Yousign, OCR réel, LLM) par intégrations cibles.

---

*Document généré pour Phase 0 — mis à jour après Phases 2–10 (démo API mémoire).*
