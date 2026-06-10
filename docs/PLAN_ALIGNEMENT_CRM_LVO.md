# 🎯 PLAN D'ALIGNEMENT CRM LVO INGÉNIERIE
## Document de référence pour Cursor AI — v1.0 (Mai 2026)

> **Objectif** : transformer la fiche technique CRM v4.0 en plan d'implémentation actionnable pour affiner ton app web existante. Chaque phase contient un prompt Cursor prêt à coller, les fichiers attendus, et les critères de validation.

---

## 📋 TABLE DES MATIÈRES

1. [Audit & Priorisation](#1-audit)
2. [Phase 0 — Préparation & Audit du code existant](#phase-0)
3. [Phase 1 — Refonte du Référencement (URGENT 🔴)](#phase-1)
4. [Phase 2 — Migrations BDD critiques](#phase-2)
5. [Phase 3 — Module Recouvrement + Intégration Quonto 🔴](#phase-3)
6. [Phase 4 — Annulations Avancées + Avoirs 🔴](#phase-4)
7. [Phase 5 — CRUD complet Contacts/Clients/Sites 🔴](#phase-5)
8. [Phase 6 — Sites multi-gestionnaires 🔴](#phase-6)
9. [Phase 7 — Phases configurables (partiel/total) 🔴](#phase-7)
10. [Phase 8 — Intégration OneDrive (versioning fichiers) 🔴](#phase-8)
11. [Phase 9 — Génération PDF/Word enrichie 🔴](#phase-9)
12. [Phase 10 — Bonus IA, OCR, e-signature](#phase-10)
13. [Phase 11 — Sécurité, audit, RGPD](#phase-11)
14. [Phase 12 — Tests & Déploiement](#phase-12)
15. [Annexe A — Prompt « META » pour Cursor](#annexe-a)
16. [Annexe B — Checklist de validation finale](#annexe-b)

---

<a id="1-audit"></a>
## 1. 🔍 AUDIT & PRIORISATION

### 1.1 Éléments en rouge (manquants ou à corriger) — TOUS À FAIRE

| # | Page | Élément | Priorité |
|---|------|---------|----------|
| R1 | 3 | Recouvrement + vérification compte **Quonto** + icône recouvrement + relance impayés | 🔴 P0 |
| R2 | 4 | Liaison compte bancaire pour vérification paiements | 🔴 P0 |
| R3 | 10 | Site : possibilité **gestionnaire par un autre client** (garder le choix) | 🟠 P1 |
| R4 | 11 | Format devis `LVO-MOE-26009`, commandes `2026-LVO-MOE-006`, factures `LVO-F2026-001` | 🔴 P0 |
| R5 | 11 | Possibilité de choisir **l'ensemble OU une partie** des phases par mission | 🟠 P1 |
| R6 | 14 | Annuler une commande : **création d'avoirs** sur factures déjà envoyées | 🔴 P0 |
| R7 | 14 | Enregistrement fichier dans offre + **conservation ancien fichier sur OneDrive** | 🟠 P1 |
| R8 | 16 | Ajouter **numéros de commande client** sur la facture | 🔴 P0 |
| R9 | 21 | **Tableau d'échéance de facturation et d'exécution** dans le PDF d'offre | 🟠 P1 |
| R10 | 21 | TVA défaut `20% / 8.5%` (DOM-TOM) + consultant défaut **Hatem LEMBARKI** | 🟢 P2 |
| R11 | 26 | **Annulation client et contact** à prévoir | 🟠 P1 |
| R12 | 31 | Supprimer contact/client **sans commande** + modifier coordonnées + modifier/supprimer site | 🟠 P1 |

### 1.2 Légende priorités
- 🔴 **P0** — Bloquant fonctionnel ou financier (à faire immédiatement)
- 🟠 **P1** — Important pour le quotidien des consultants
- 🟢 **P2** — Confort / optimisation

### 1.3 Modules robustesse imaginés (BONUS — à activer selon besoin)

| # | Feature | Valeur ajoutée |
|---|---------|----------------|
| B1 | **OCR auto sur bons de commande** (extraction client, montant, ref) | Gain temps massif |
| B2 | **IA assistante** : suggestion de phases selon type de mission | Cohérence offres |
| B3 | **E-signature intégrée** (Yousign / DocuSign) | Cycle de vente accéléré |
| B4 | **Portail client** (lecture seule : offres, factures, planning) | Transparence |
| B5 | **Notifications Slack/Teams** | Réactivité équipe |
| B6 | **Prévisions de trésorerie** (cashflow) | Pilotage stratégique |
| B7 | **Recherche globale Cmd+K** | Productivité |
| B8 | **Mode hors-ligne (PWA)** | Mobilité chantier |
| B9 | **Calcul automatique du taux de transformation par consultant** | Coaching |
| B10 | **Webhooks** sortants (Zapier, Make.com) | Intégrations |
| B11 | **Bulk actions** (annuler/dupliquer/exporter en masse) | Gestion volume |
| B12 | **Audit log viewer** avec filtres avancés | Conformité RGPD |
| B13 | **Tableau de bord par consultant personnalisable** | Engagement |
| B14 | **Import Excel** wizard pour migration de données | Onboarding |
| B15 | **Prédiction conversion offre → commande** (ML simple) | Forecasting |

---

<a id="phase-0"></a>
## 2. 🚀 PHASE 0 — Préparation & Audit du code existant

### Objectif
Avant toute modification, demander à Cursor un audit du code actuel pour identifier les écarts avec la fiche technique.

### 📝 Prompt Cursor à coller

```
Tu es l'ingénieur responsable du CRM LVO Ingénierie. J'ai joint la fiche technique 
v4.0 (FICHE-TECH-CRM-LVO-2026-V1) et tu vas l'utiliser comme spec de référence.

ÉTAPE 1 — AUDIT
Parcours le code du projet (ex. frontend React/Next.js + backend Node/NestJS + Prisma 
selon ce qui est présent dans le dépôt — adapte si le repo est partiel) et 
produis un rapport `AUDIT.md` à la racine du repo avec :

1. Inventaire des modules présents (avec chemin du fichier principal)
2. Inventaire des modules MANQUANTS par rapport à la fiche technique :
   - Module Recouvrement / Quonto
   - Système d'avoirs sur annulation commande
   - OneDrive versioning fichiers
   - Annulation contacts/clients
   - Suppression contact/client/site (avec règles de gestion)
   - Tableau échéancier dans le PDF d'offre
   - Numéro de commande client sur facture
3. Schéma de la BDD actuelle (lis `schema.prisma` ou les migrations SQL) vs 
   schéma cible de la section 18 de la fiche technique. Liste les tables et 
   colonnes manquantes.
4. Liste des endpoints API présents vs section 19.2 de la fiche technique.
5. Pour chaque écart, propose un niveau de priorité (P0/P1/P2) et une estimation 
   en jours-homme.

NE MODIFIE RIEN à ce stade. Produis uniquement AUDIT.md.
```

### Livrables attendus
- `AUDIT.md` à la racine
- Estimation chiffrée
- Carte des écarts BDD

### Critères de validation
- [ ] Les 12 exigences R1–R12 (section 1.1) sont listées dans l'audit
- [ ] Chaque écart a une priorité et un fichier cible
- [ ] Schéma de données actuel correctement décrit (ex. `schema.prisma` ou équivalent, ou mention explicite si absent du dépôt)

---

<a id="phase-1"></a>
## 3. 🔴 PHASE 1 — Refonte du Référencement (R4)

### Objectif
Implémenter les 3 formats officiels de référence, avec génération atomique côté backend (anti-collision).

### Spécification précise

**DEVIS / OFFRES** : `LVO-{TYPE_MISSION}-{YY}{NNN}{REV?}`
- `YY` = année sur 2 chiffres (26 pour 2026)
- `NNN` = compteur annuel commençant à 001, **remis à zéro chaque 1er janvier**
- `REV` = lettre A, B, C... ajoutée **uniquement en cas de duplication** (révision)
- Exemple : `LVO-MOE-26009`, après 2 duplications → `LVO-MOE-26009-A`, `LVO-MOE-26009-B`

**COMMANDES** : `{YYYY}-LVO-{TYPE_MISSION}-{NNN}`
- `YYYY` = année sur 4 chiffres
- `NNN` = compteur annuel remis à zéro
- Exemple : `2026-LVO-MOE-006`

**FACTURES** : `LVO-F{YYYY}-{NNN}`
- Compteur annuel
- Exemple : `LVO-F2026-001`

### 📝 Prompt Cursor à coller

```
Refonte complète du système de référencement pour les offres, commandes et factures.

CONTEXTE
La fiche technique impose 3 formats stricts :
- Offres   : LVO-{TYPE}-{YY}{NNN}[-{REV}]   ex: LVO-MOE-26009 ou LVO-MOE-26009-A
- Commandes: {YYYY}-LVO-{TYPE}-{NNN}        ex: 2026-LVO-MOE-006
- Factures : LVO-F{YYYY}-{NNN}              ex: LVO-F2026-001

Le compteur NNN est annuel (remise à zéro le 1er janvier).
TYPE = code mission (A, ADC, MOE, ET, MCM, MCN, MM, MS).
La lettre REV (A, B, C...) n'est ajoutée qu'à la duplication d'une offre.

À FAIRE

1. Créer une table `reference_counters` :
   - id (uuid)
   - entity_type (enum: OFFRE | COMMANDE | FACTURE)
   - year (int)
   - type_mission (varchar nullable, utilisé pour les offres/commandes)
   - last_value (int)
   - updated_at (timestamptz)
   UNIQUE INDEX sur (entity_type, year, type_mission)

2. Créer un service `reference.service.ts` (NestJS) avec une méthode 
   `nextReference(entityType, year, typeMission?)` qui :
   - utilise une transaction PostgreSQL avec SELECT FOR UPDATE
   - incrémente le compteur de manière ATOMIQUE (pas de race condition)
   - formate la chaîne selon les règles ci-dessus

3. Pour les duplications d'offres :
   - Si on duplique LVO-MOE-26009, retrouver toutes les révisions existantes 
     (LVO-MOE-26009, LVO-MOE-26009-A, LVO-MOE-26009-B) et générer la suivante
   - Stocker la sequence et la revision dans deux colonnes séparées en BDD 
     (sequence INT, revision CHAR(1) NULLABLE)

4. Migrer les données existantes :
   - Créer un script `scripts/migrate-references.ts` qui régénère les 
     références au nouveau format pour toutes les entités existantes
   - Conserver l'ancienne référence dans une colonne `legacy_reference` 
     pour traçabilité

5. Tests unitaires (Jest) :
   - Génération concurrente (10 appels parallèles → pas de doublons)
   - Reset à chaque année
   - Incrémentation correcte des révisions
   - Format des chaînes pour les 3 entités

6. Mettre à jour tous les endroits qui affichent la référence dans le frontend 
   (liste des offres, fiche détail, PDF, emails) — utiliser la colonne 
   `reference` de la BDD (pas de logique côté front).

VALIDATION
Tu dois pouvoir créer 100 offres en parallèle sans collision et toutes les 
références doivent suivre le format exact.
```

### Critères de validation
- [ ] Test de charge : 100 créations parallèles sans collision
- [ ] Reset annuel testé (insérer un row daté du 31/12 puis 01/01)
- [ ] Duplication incrémente bien A → B → C
- [ ] Migration des données existantes sans perte
- [ ] Frontend affiche les nouvelles références partout

---

<a id="phase-2"></a>
## 4. 🟠 PHASE 2 — Migrations BDD critiques

### Objectif
Aligner le schéma sur la section 18 de la fiche technique + ajouter les colonnes nécessaires aux features rouges.

### 📝 Prompt Cursor à coller

```
Crée une nouvelle migration Prisma `add_lvo_alignment_v1` qui contient TOUS 
les changements suivants. Si Prisma : ajoute aussi les modèles dans 
schema.prisma. Si TypeORM : crée des entities. Adapte selon le stack.

==============================================================
1. NOUVELLES TABLES
==============================================================

TABLE: reference_counters  (cf. Phase 1)

TABLE: avoirs
  id UUID PK
  numero VARCHAR(30) UNIQUE NOT NULL  -- ex: LVO-AV2026-001
  facture_origine_id UUID FK -> factures(id) NOT NULL
  commande_id UUID FK -> commandes(id) NOT NULL
  motif VARCHAR(200) NOT NULL
  montant_ht DECIMAL(12,2) NOT NULL
  taux_tva DECIMAL(5,2) NOT NULL
  montant_ttc DECIMAL(12,2) NOT NULL
  date_emission DATE NOT NULL
  pdf_path TEXT
  created_by UUID FK -> users(id)
  created_at TIMESTAMPTZ DEFAULT NOW()

TABLE: paiements
  id UUID PK
  facture_id UUID FK -> factures(id) NOT NULL
  montant DECIMAL(12,2) NOT NULL
  date_paiement DATE NOT NULL
  source ENUM('QUONTO_AUTO', 'MANUEL', 'IMPORT_CSV') NOT NULL
  reference_externe VARCHAR(100)  -- ID transaction Quonto
  quonto_transaction_id VARCHAR(100)  -- pour idempotence
  rapproche_at TIMESTAMPTZ DEFAULT NOW()
  rapproche_by UUID FK -> users(id) NULLABLE  -- null si auto
  notes TEXT
  UNIQUE INDEX (quonto_transaction_id) WHERE quonto_transaction_id IS NOT NULL

TABLE: relances
  id UUID PK
  facture_id UUID FK -> factures(id) NOT NULL
  niveau ENUM('RAPPEL', 'PREMIERE_RELANCE', 'DEUXIEME_RELANCE', 'MISE_EN_DEMEURE')
  date_envoi TIMESTAMPTZ NOT NULL
  canal ENUM('EMAIL', 'COURRIER', 'TELEPHONE')
  contenu TEXT
  envoye_par UUID FK -> users(id)
  reponse_recue_at TIMESTAMPTZ NULLABLE

TABLE: site_gestionnaires  (R3 - multi-gestionnaires)
  id UUID PK
  site_id UUID FK -> sites(id) NOT NULL
  client_id UUID FK -> clients(id) NOT NULL  -- client gestionnaire (peut différer du propriétaire)
  is_principal BOOLEAN DEFAULT FALSE
  date_debut DATE
  date_fin DATE NULLABLE
  notes TEXT
  UNIQUE INDEX (site_id, client_id)

TABLE: fichiers_versions  (R7 - versioning OneDrive)
  id UUID PK
  fichier_id UUID FK -> fichiers(id) NOT NULL
  version_num INT NOT NULL
  s3_path TEXT
  onedrive_path TEXT  -- chemin sur OneDrive après archivage
  onedrive_item_id VARCHAR(100)  -- id OneDrive
  taille_octets BIGINT
  checksum_sha256 VARCHAR(64)
  uploaded_by UUID FK -> users(id)
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
  archived_to_onedrive_at TIMESTAMPTZ NULLABLE

==============================================================
2. NOUVELLES COLONNES SUR TABLES EXISTANTES
==============================================================

ALTER TABLE factures ADD:
  numero_commande_client VARCHAR(100) NULLABLE  -- R8
  statut_paiement ENUM('NON_PAYE', 'PARTIELLEMENT_PAYE', 'PAYE', 'EN_RETARD') DEFAULT 'NON_PAYE'
  montant_paye DECIMAL(12,2) DEFAULT 0
  derniere_relance_at TIMESTAMPTZ NULLABLE
  niveau_relance INT DEFAULT 0

ALTER TABLE offres ADD:
  legacy_reference VARCHAR(50) NULLABLE  -- ancienne ref pour migration
  echeancier_facturation_json JSONB NULLABLE  -- R9 : tableau dans PDF
  echeancier_execution_json JSONB NULLABLE
  consultant_par_defaut_id UUID NULLABLE  -- R10

ALTER TABLE commandes ADD:
  legacy_reference VARCHAR(50) NULLABLE
  numero_client VARCHAR(100) NULLABLE  -- ref client portée sur facture (R8)

ALTER TABLE contacts ADD:
  statut ENUM('ACTIF', 'ANNULE', 'ARCHIVE') DEFAULT 'ACTIF'  -- R11
  cancelled_at TIMESTAMPTZ NULLABLE
  cancelled_by UUID FK -> users(id) NULLABLE
  cancellation_reason VARCHAR(200) NULLABLE

ALTER TABLE clients ADD:
  statut ENUM('ACTIF', 'ANNULE', 'ARCHIVE') DEFAULT 'ACTIF'  -- R11
  cancelled_at TIMESTAMPTZ NULLABLE
  cancelled_by UUID FK -> users(id) NULLABLE
  cancellation_reason VARCHAR(200) NULLABLE

ALTER TABLE phases_offre ADD:
  est_inclus BOOLEAN DEFAULT TRUE  -- R5 : possibilité d'exclure une phase
  commentaire_phase TEXT NULLABLE

==============================================================
3. INDEX & CONTRAINTES
==============================================================

CREATE INDEX idx_factures_statut_paiement ON factures(statut_paiement);
CREATE INDEX idx_factures_date_echeance ON factures(date_echeance) 
  WHERE statut_paiement IN ('NON_PAYE', 'PARTIELLEMENT_PAYE', 'EN_RETARD');
CREATE INDEX idx_paiements_facture ON paiements(facture_id);
CREATE INDEX idx_relances_facture ON relances(facture_id);
CREATE INDEX idx_avoirs_facture ON avoirs(facture_origine_id);

==============================================================
4. SEED DATA
==============================================================

Mettre à jour les seeds avec :
- Compteur initial à 0 pour 2026 sur OFFRE/COMMANDE/FACTURE
- Consultant par défaut : Hatem LEMBARKI (code HL2 ou HB selon ce qui existe)
  Note : la fiche technique mentionne deux Hatem (Hatem BENZARTI HB et 
  Hatem LEMBARKI). Vérifier avec moi avant de hardcoder.

LIVRABLE
- Migration SQL `prisma/migrations/YYYYMMDDHHMMSS_lvo_alignment_v1/migration.sql`
- Mise à jour `schema.prisma` avec tous les nouveaux modèles
- Régénération du client Prisma
- Tests d'intégrité (FK, NOT NULL)
```

### Critères de validation
- [ ] `npx prisma migrate dev` passe sans erreur
- [ ] Toutes les FK sont valides
- [ ] Les index sont créés
- [ ] Le seed s'exécute correctement

---

<a id="phase-3"></a>
## 5. 🔴 PHASE 3 — Module Recouvrement + Quonto (R1, R2)

### Objectif
Connecter le CRM au compte bancaire Quonto pour rapprocher automatiquement les paiements et déclencher les relances.

### Architecture cible

```
┌─────────────┐    OAuth2     ┌──────────────┐
│   Quonto    │◄──────────────│   CRM LVO    │
│   API       │               │              │
└─────┬───────┘               └──────┬───────┘
      │                              │
      │ Webhook + Polling             │ Cron quotidien
      │ (transactions)                │
      ▼                              ▼
┌──────────────────────────────────────────┐
│  Service de rapprochement automatique     │
│  - Match libellé/montant/date             │
│  - Score de confiance (0-100)             │
│  - Auto-validation si score > 90          │
│  - Sinon → file d'attente humaine          │
└──────────────────────────────────────────┘
```

### 📝 Prompt Cursor à coller

```
Implémenter le module Recouvrement avec intégration Quonto.

==============================================================
A. CONNECTEUR QUONTO
==============================================================

1. Créer `services/quonto/quonto.client.ts` :
   - Auth OAuth2 (client_credentials ou code, selon le compte business)
   - Méthodes : listTransactions(from, to, accountId), getTransaction(id), 
     subscribeWebhook(url)
   - Stockage du access_token + refresh_token dans une table `oauth_tokens` 
     chiffrée AES-256 (au repos)
   - Gestion des erreurs : retry avec backoff exponentiel
   - Rate limiting respecté (Quonto limite ~60 req/min)

2. Configuration via env :
   QUONTO_CLIENT_ID
   QUONTO_CLIENT_SECRET
   QUONTO_API_BASE_URL=https://thirdparty.qonto.com/v2
   QUONTO_WEBHOOK_SECRET
   QUONTO_ORGANIZATION_SLUG

3. Endpoint webhook : POST /api/v1/webhooks/quonto
   - Vérifier la signature HMAC
   - Insérer la transaction dans la table `paiements` AVEC 
     quonto_transaction_id (idempotence)
   - Déclencher le job de rapprochement

==============================================================
B. SERVICE DE RAPPROCHEMENT
==============================================================

`services/recouvrement/reconciliation.service.ts`

Algorithme de scoring (0-100) :
  +40 si montant exact (à 1 centime près)
  +20 si montant dans ±0.5%
  +30 si numéro de facture trouvé dans le libellé (regex LVO-F\d{4}-\d{3})
  +15 si nom client trouvé dans le libellé (fuzzy match Levenshtein < 3)
  +10 si IBAN du client trouvé
  +5  si paiement reçu dans la fenêtre [date_facture, date_echeance + 30j]

Si score >= 90 → marquer la facture comme PAYÉE, créer le paiement, source=QUONTO_AUTO
Si score 60-89 → créer le paiement en statut "À VALIDER" + notification admin
Si score < 60 → ignorer, transaction reste en file d'attente

==============================================================
C. UI RECOUVREMENT
==============================================================

Nouvelle page `/recouvrement` (rôle MANAGER+) avec :

1. KPIs en haut :
   - Total impayé (€ HT/TTC) 
   - Nombre de factures en retard
   - Délai moyen de paiement (DSO — Days Sales Outstanding)
   - Top 5 clients en retard

2. Liste des factures impayées avec colonnes :
   - Référence (LVO-F...)
   - Client
   - Montant
   - Date émission / Date échéance
   - Retard (en jours, badge couleur : vert ≤0, jaune 1-15, orange 16-30, rouge >30)
   - Niveau de relance (0/1/2/3)
   - Actions : 📧 Relancer · 💰 Marquer payé · 📞 Noter contact · 🧾 Voir avoir

3. File d'attente "À rapprocher" :
   - Transactions Quonto non rapprochées (score 60-89)
   - Bouton "Rapprocher avec une facture" → modal de sélection
   - Bouton "Ignorer" (commission, frais, etc.)

4. Icône GLOBALE dans la sidebar :
   - 💰 Recouvrement avec badge rouge si > 0 facture en retard
   - Cliquable → ouvre la page

==============================================================
D. MOTEUR DE RELANCES AUTOMATIQUES
==============================================================

Cron job quotidien `crons/relances-auto.cron.ts` (à 9h00 Europe/Paris) :

  Pour chaque facture impayée :
    Si J+0 (date_echeance dépassée d'1 jour) ET niveau_relance = 0:
      → Envoyer email "Rappel amical" + niveau = 1
    Si J+15 ET niveau = 1:
      → Envoyer email "1ère relance" + notification consultant
    Si J+30 ET niveau = 2:
      → Envoyer email "2ème relance" formelle + notif Manager
    Si J+45 ET niveau = 3:
      → Tâche manuelle créée pour Admin (mise en demeure à valider humainement)

Modèles d'email à créer dans la table `email_templates` :
  - relance_rappel
  - relance_premiere
  - relance_deuxieme
  - mise_en_demeure_draft

Variables : [REFERENCE], [MONTANT_TTC], [DATE_ECHEANCE], [JOURS_RETARD], 
            [CLIENT_NOM], [CONSULTANT_PRENOM]

==============================================================
E. ENDPOINTS API
==============================================================

GET    /api/v1/recouvrement/factures-impayees
GET    /api/v1/recouvrement/kpis
POST   /api/v1/recouvrement/factures/:id/relance       (force une relance)
POST   /api/v1/recouvrement/factures/:id/payer-manuel  (saisie manuelle paiement)
POST   /api/v1/recouvrement/transactions/:id/rapprocher
POST   /api/v1/quonto/sync-now                         (force la synchro Quonto)
GET    /api/v1/quonto/transactions-en-attente

==============================================================
F. TESTS
==============================================================

- Mock du client Quonto (nock ou MSW)
- Test du scoring sur 20 cas typiques
- Test d'idempotence du webhook (même transaction reçue 2x → 1 seul paiement)
- Test du cron de relances
- Test E2E : créer facture → simuler virement Quonto → vérifier passage en PAYÉE

==============================================================
G. SÉCURITÉ
==============================================================

- Le webhook valide la signature HMAC (header X-Qonto-Signature)
- Les tokens OAuth sont chiffrés en BDD (AES-256-GCM, clé dans secrets manager)
- Audit log obligatoire pour toute action de rapprochement manuel
- Seul ADMIN peut configurer la connexion Quonto initiale
```

### Critères de validation
- [ ] Webhook Quonto reçu et traité avec succès (test sandbox)
- [ ] Idempotence vérifiée (même payload 2x = 1 seul paiement)
- [ ] Scoring testé sur cas limites
- [ ] Cron de relances déclenche les bons emails aux bons jours
- [ ] Tokens OAuth chiffrés en BDD
- [ ] Page Recouvrement responsive et performante

> 📌 **Note** : si le compte Quonto est en mode "non-API" ou que l'accès partenaire n'est pas encore obtenu, prévoir un **fallback CSV** : import manuel d'un export bancaire avec le même algorithme de rapprochement.

---

<a id="phase-4"></a>
## 6. 🔴 PHASE 4 — Annulations Avancées + Avoirs (R6, R11)

### Objectif
Permettre l'annulation d'une commande avec génération automatique d'avoirs sur les factures déjà émises, et étendre l'annulation aux contacts/clients.

### 📝 Prompt Cursor à coller

```
Étendre le système d'annulation pour couvrir 4 scénarios :

==============================================================
1. ANNULATION COMMANDE AVEC GÉNÉRATION D'AVOIRS (R6)
==============================================================

Workflow UI :

  [Bouton ✕ sur une commande]
        ↓
  Modal "Annuler la commande {ref}"
  ┌───────────────────────────────────────────────┐
  │ Motif * : [Refus client v]                    │
  │ Commentaire : [______________]                │
  │                                               │
  │ ⚠ Cette commande a 3 factures émises :        │
  │   ☐ FAC-2026-0143 — 12 500 € — Payée          │
  │   ☑ FAC-2026-0156 — 8 200 €  — Non payée      │
  │   ☑ FAC-2026-0167 — 5 100 €  — Non payée      │
  │                                               │
  │ Action sur factures non payées :              │
  │   ◉ Émettre des avoirs équivalents             │
  │   ○ Annuler les factures (mode brouillon)      │
  │   ○ Ne rien faire                              │
  │                                               │
  │ Action sur factures payées :                  │
  │   ◉ Émettre un avoir avec remboursement        │
  │   ○ Avoir avec compensation future             │
  │   ○ Ne rien faire (à traiter manuellement)     │
  │                                               │
  │  [Annuler]    [✕ Confirmer l'annulation]      │
  └───────────────────────────────────────────────┘

Backend `commandes.service.ts::cancel(id, options)` :

  TRANSACTION:
    1. Vérifier permissions (MANAGER+)
    2. Snapshot de la commande + factures liées dans historique_annulations
    3. Pour chaque facture cochée :
       - Générer un avoir avec numéro LVO-AV{YYYY}-{NNN}
       - Lier l'avoir à la facture d'origine
       - Si facture payée et option "remboursement" : créer une demande 
         de remboursement (statut À_REMBOURSER) — visible dans le module 
         recouvrement
    4. Marquer la commande en statut ANNULÉE
    5. Marquer l'offre liée en statut ANNULÉE (cascade)
    6. Supprimer les jalons d'échéancier futurs (statut PLANIFIÉ)
    7. Audit log
  COMMIT

==============================================================
2. GÉNÉRATION DOCUMENT AVOIR (PDF + Word)
==============================================================

Service `documents/avoir-generator.service.ts` :
  - Template identique à la facture mais titre rouge "AVOIR"
  - Référence facture d'origine en haut
  - Montants en NÉGATIF
  - Mention obligatoire RGPD/comptable : 
    "Le présent avoir annule et remplace la facture {REF} émise le {DATE}"
  - Stockage S3 + lien dans table avoirs

==============================================================
3. ANNULATION DE CONTACT (R11)
==============================================================

Règles :
  - ADMIN ou MANAGER peuvent annuler
  - Si le contact est interlocuteur sur une commande active → BLOQUÉ avec 
    message clair listant les commandes concernées
  - Si le contact a un compte plateforme actif → désactiver le compte
  - Soft delete : statut = 'ANNULE', conservation des données 7 ans (RGPD)
  - Apparaît dans une page "Contacts archivés" filtrable

==============================================================
4. ANNULATION DE CLIENT (R11)
==============================================================

Règles :
  - ADMIN uniquement
  - Si le client a au moins 1 commande non terminée → BLOQUÉ
  - Si le client a des sites → demander confirmation pour cascader 
    (sites passés en ARCHIVE)
  - Si le client a des contacts → idem
  - Soft delete

==============================================================
5. PAGE HISTORIQUE ANNULATIONS — Extensions
==============================================================

Ajouter 2 nouveaux onglets :
  - 👤 Contacts annulés
  - 🏢 Clients annulés

Pour chacun :
  - Tableau avec date d'annulation, motif, commentaire, annulé par, 
    bouton "Restaurer" (ADMIN seulement)

==============================================================
6. ENDPOINTS API
==============================================================

POST   /api/v1/commandes/:id/cancel        (body: motif, commentaire, options)
POST   /api/v1/contacts/:id/cancel
POST   /api/v1/clients/:id/cancel
POST   /api/v1/contacts/:id/restore        (ADMIN)
POST   /api/v1/clients/:id/restore         (ADMIN)
GET    /api/v1/avoirs
GET    /api/v1/avoirs/:id/pdf
POST   /api/v1/avoirs/:id/regenerate-pdf

==============================================================
7. RAPPORTS — Onglet 4 mis à jour
==============================================================

Ajouter dans l'onglet "Annulations & Historique" :
  - Compteur Avoirs émis
  - Montant total avoirs
  - Graphique : raisons d'annulation pondérées par montant
```

### Critères de validation
- [ ] Annulation commande avec 3 factures (1 payée, 2 non payées) génère 3 avoirs corrects
- [ ] Tentative de suppression contact lié à commande active → erreur claire
- [ ] PDF avoir conforme aux mentions comptables françaises
- [ ] Historique permet la restauration d'un client (ADMIN)
- [ ] Cascade contact → désactivation compte plateforme

---

<a id="phase-5"></a>
## 7. 🟠 PHASE 5 — CRUD complet Contacts/Clients/Sites (R12)

### Objectif
Compléter les opérations de modification et de suppression conformément à la fin de la fiche technique.

### 📝 Prompt Cursor à coller

```
Implémenter le CRUD complet pour Contacts, Clients et Sites avec règles de 
gestion strictes.

==============================================================
A. SUPPRESSION (HARD DELETE)
==============================================================

Règle absolue : un contact/client/site ne peut être SUPPRIMÉ DÉFINITIVEMENT 
que s'il n'a AUCUNE commande enregistrée (terminée ou non).

Workflow :
  1. Tentative de suppression (bouton 🗑 dans la fiche)
  2. Modal "Confirmer la suppression"
  3. Backend vérifie :
     - Pour Contact : aucune commande où contact est interlocuteur
     - Pour Client : aucune commande, aucune facture, aucun site avec activité
     - Pour Site : aucune offre/commande active sur ce site
  4. Si OK → DELETE en cascade (interventions, etc.)
  5. Si NON OK → message :
     "Impossible de supprimer. {N} commandes liées. 
      Souhaitez-vous plutôt l'annuler ?" → bouton vers annulation

Endpoints :
  DELETE /api/v1/contacts/:id
  DELETE /api/v1/clients/:id
  DELETE /api/v1/sites/:id

Permissions :
  - ADMIN partout
  - MANAGER : oui sauf suppression client (réservée ADMIN)
  - CONSULTANT : seulement ses contacts non liés

==============================================================
B. MODIFICATION COORDONNÉES (CONTACTS, CLIENTS)
==============================================================

Permettre la modification de TOUS les champs sauf l'ID :
  - Email : si modifié, vérifier unicité, envoyer email de confirmation 
    sur la nouvelle adresse, ancien email gardé en historique
  - SIRET client : modification possible mais loggée en audit (changement 
    rare et important)
  - Adresse : versionnée dans table `adresses_history`

UI :
  - Mode lecture par défaut sur la fiche
  - Bouton "Modifier" pour passer en édition inline
  - Validation des changements importants (email, SIRET) avec MFA si 
    activé sur le compte de l'utilisateur

==============================================================
C. MODIFICATION ET SUPPRESSION SITE
==============================================================

Champs modifiables :
  - Tous sauf l'historique des appareils
  - Modification du client propriétaire = changement majeur, log audit + 
    notification au consultant gestionnaire

Suppression site :
  - Bloquée si offres/commandes/factures liées non annulées
  - Sinon soft delete (statut ARCHIVE) puis hard delete possible après 
    7 ans (compatible RGPD)

==============================================================
D. ENDPOINTS API
==============================================================

PATCH  /api/v1/contacts/:id     (partial update)
PUT    /api/v1/contacts/:id     (full update)
DELETE /api/v1/contacts/:id

PATCH  /api/v1/clients/:id
PUT    /api/v1/clients/:id
DELETE /api/v1/clients/:id

PATCH  /api/v1/sites/:id
PUT    /api/v1/sites/:id
DELETE /api/v1/sites/:id

==============================================================
E. AUDIT TRAIL
==============================================================

Chaque modification créé une entrée dans `audit_log` avec :
  - entity_type
  - entity_id
  - action (CREATE | UPDATE | DELETE | CANCEL | RESTORE)
  - changes (JSONB diff before/after)
  - performed_by
  - performed_at
  - ip_address
  - user_agent

Page admin `/admin/audit` (ADMIN uniquement) avec filtres et export CSV.
```

### Critères de validation
- [ ] Suppression bloquée si entités liées
- [ ] Modification email envoie confirmation sur nouvelle adresse
- [ ] Audit trail complet et exportable
- [ ] Permissions par rôle respectées

---

<a id="phase-6"></a>
## 8. 🟠 PHASE 6 — Sites multi-gestionnaires (R3)

### Objectif
Un site peut être **possédé par un client** mais **géré par un autre client** (cas fréquent : copropriété gérée par un syndic).

### 📝 Prompt Cursor à coller

```
Étendre le modèle Site pour supporter des gestionnaires multiples.

CONTEXTE MÉTIER
Exemple typique : 
  - Site : "Résidence Les Lilas, 12 rue X"
  - Propriétaire (client) : SCI Les Lilas
  - Gestionnaire principal (client) : Foncia Île-de-France
  - Gestionnaire secondaire : autre client de gestion

À FAIRE

1. La table `site_gestionnaires` est déjà créée (Phase 2). Compléter 
   le modèle Prisma :
   
   model Site {
     ...
     proprietaireClientId String  // existant
     gestionnaires        SiteGestionnaire[]  // nouveau (1-N)
   }

2. UI Formulaire Site :
   - Champ "Client propriétaire" reste inchangé
   - Nouvelle section "Gestionnaires du site"
     - Liste des gestionnaires actuels avec dates début/fin
     - Bouton "+ Ajouter un gestionnaire"
     - Modal : recherche client + champ "Principal ?" + dates + notes
     - Possibilité de modifier la date de fin (transfert de gestion)
   - GARDER LE CHOIX : possibilité de NE PAS définir de gestionnaire 
     (le propriétaire fait tout)

3. UI Liste Sites :
   - Nouvelle colonne "Gestionnaire principal" (affiche le client 
     marqué is_principal=true, ou "—" si aucun)
   - Filtre par gestionnaire dans la barre de filtres

4. UI Offres :
   - Quand on crée une offre sur un site multi-gestionnaire, le 
     formulaire propose : "À quel client cette offre est-elle 
     destinée ?" avec les options : propriétaire OU gestionnaire(s)
   - Par défaut : gestionnaire principal s'il existe, sinon propriétaire

5. Règles de gestion :
   - Un seul gestionnaire principal à la fois (contrainte UNIQUE 
     partielle WHERE is_principal=true)
   - Lors d'un changement de gestionnaire principal, l'ancien passe 
     en is_principal=false avec date_fin = aujourd'hui
   - Historique conservé (jamais de hard delete sur cette table)

6. Endpoints :
   POST   /api/v1/sites/:id/gestionnaires
   PATCH  /api/v1/sites/:id/gestionnaires/:gestionnaireId
   DELETE /api/v1/sites/:id/gestionnaires/:gestionnaireId  (soft : date_fin)
   POST   /api/v1/sites/:id/gestionnaires/:gestionnaireId/promouvoir
          (devient principal)

7. Rapports :
   - Onglet 0 (Vue générale) : ajouter un graphique 
     "Top 10 gestionnaires par CA"
```

### Critères de validation
- [ ] Création site avec 0, 1 ou plusieurs gestionnaires fonctionne
- [ ] Un seul `is_principal=true` à la fois (test concurrence)
- [ ] Changement de gestionnaire principal historisé
- [ ] Filtre par gestionnaire dans liste sites

---

<a id="phase-7"></a>
## 9. 🟠 PHASE 7 — Phases configurables (partiel/total) (R5)

### Objectif
Permettre de sélectionner pour chaque mission soit l'ensemble des phases standards, soit un sous-ensemble personnalisé.

### 📝 Prompt Cursor à coller

```
Refondre le système de phases pour offrir une UX claire entre 
"phases standard" et "phases sur-mesure".

UX CIBLE — Formulaire d'offre

Quand on choisit "Type de mission" :

  ┌────────────────────────────────────────────────────────┐
  │ Type de mission : [MCN — Mission Complète Neuf v]     │
  │                                                        │
  │ Configuration des phases :                             │
  │   ◉ Toutes les phases standard (recommandé)            │
  │   ○ Sélectionner certaines phases uniquement           │
  │   ○ Configuration personnalisée (mission spéciale)     │
  │                                                        │
  │ ┌─────────────────────────────────────────────────┐    │
  │ │ ☑ ESQ — Esquisse                  [3 500 €]    │    │
  │ │ ☑ APS — Avant-Projet Sommaire     [6 000 €]    │    │
  │ │ ☑ APD — Avant-Projet Détaillé     [8 500 €]    │    │
  │ │ ☐ PRO — Projet                    [12 000 €]   │    │
  │ │ ☑ DCE — Dossier Consultation      [4 500 €]    │    │
  │ │ ...                                              │    │
  │ │                                                  │    │
  │ │ Total HT phases sélectionnées : 22 500 €        │    │
  │ └─────────────────────────────────────────────────┘    │
  │                                                        │
  │ [ Détails par phase ▼ ]                                │
  └────────────────────────────────────────────────────────┘

À FAIRE

1. Table `phases_offre` modifier :
   - Ajouter `est_inclus BOOLEAN DEFAULT TRUE` (déjà fait Phase 2)
   - Ajouter `ordre_affichage INT`

2. Table `phases_referentiel` (NOUVELLE) :
   Stocker les phases standard par type de mission.
   id UUID PK
   type_mission ENUM
   code_phase VARCHAR(10)  -- ESQ, APS, etc.
   libelle VARCHAR(100)
   prix_indicatif_ht DECIMAL(10,2)
   ordre INT
   actif BOOLEAN

3. Seed avec les phases de la section 7.6 de la fiche technique :
   - MCN : ESQ, APS, APD, PRO, DCE, AMT, ACT, VISA, DET, AOR, GPA
   - MCM : idem + Audit en plus
   - MOE : VISA, DET, AOR
   - etc.

4. UI :
   - 3 modes : "Toutes" / "Sélection" / "Personnalisé"
   - Mode "Sélection" : checkbox par phase avec prix éditable
   - Mode "Personnalisé" : ajout libre de phases hors catalogue
   - Récapitulatif total HT en bas, mis à jour en temps réel

5. PDF d'offre :
   - Lister UNIQUEMENT les phases incluses
   - Pour chaque phase : libellé, description courte, prix HT, échéance

6. Endpoints :
   GET  /api/v1/phases-referentiel?typeMission=MCN
   POST /api/v1/offres/:id/phases (bulk create/update)

7. Calcul automatique du montant total de l'offre = SUM(phases incluses)
```

### Critères de validation
- [ ] Mode "Toutes" coche automatiquement toutes les phases du référentiel
- [ ] Mode "Sélection" recalcule le total instantanément
- [ ] PDF n'affiche que les phases cochées
- [ ] Phases personnalisées (Mission Spéciale) fonctionnent

---

<a id="phase-8"></a>
## 10. 🟠 PHASE 8 — OneDrive versioning fichiers (R7)

### Objectif
Quand un fichier est remplacé sur une offre, l'ancien est archivé sur OneDrive (et non écrasé).

### 📝 Prompt Cursor à coller

```
Implémenter le versioning des fichiers d'offre avec archivage OneDrive.

==============================================================
A. CONNECTEUR ONEDRIVE
==============================================================

Utiliser Microsoft Graph API.

1. Authentification : OAuth2 avec compte service Azure AD 
   (client_credentials avec permissions Files.ReadWrite.All)

2. ENV requis :
   AZURE_TENANT_ID
   AZURE_CLIENT_ID
   AZURE_CLIENT_SECRET
   ONEDRIVE_ARCHIVE_FOLDER_ID  (ID du dossier "/CRM_Archive" sur OneDrive)
   ONEDRIVE_DRIVE_ID

3. Service `services/onedrive/onedrive.client.ts` :
   - uploadFile(buffer, fileName, parentFolderId) → returns itemId
   - createFolder(parentFolderId, name)
   - getFileMetadata(itemId)
   - moveFile(itemId, newParentId)

==============================================================
B. WORKFLOW VERSIONING
==============================================================

Quand un consultant uploade un nouveau fichier sur une offre qui en a déjà un :

1. Le fichier ACTUEL (S3) est marqué archived_to_onedrive_at = NULL 
   et ajouté en queue Bull/BullMQ
2. Job d'archivage :
   - Téléchargement depuis S3
   - Upload vers OneDrive dans le dossier 
     /CRM_Archive/{YYYY}/{REF_OFFRE}/v{N}_{filename}
   - Mise à jour fichiers_versions.onedrive_path et onedrive_item_id
   - Mise à jour archived_to_onedrive_at = NOW()
   - Suppression S3 après vérification (configurable, défaut : conserver 30j)
3. Le nouveau fichier devient v{N+1} en S3

==============================================================
C. UI HISTORIQUE DES VERSIONS
==============================================================

Sur la fiche d'une offre, section Fichiers :

  📎 Fichiers de l'offre
  ┌──────────────────────────────────────────────────────┐
  │ Bon_Commande_SIDR_v3.pdf  [Actuel]   📥 DL          │
  │ Modifié le 12/05/2026 par Hatem                      │
  │                                                      │
  │ Versions précédentes :                               │
  │   v2 — Bon_Commande_SIDR_v2.pdf  📥 DL (OneDrive)    │
  │       Archivé le 02/05/2026                          │
  │   v1 — Bon_Commande_SIDR.pdf     📥 DL (OneDrive)    │
  │       Archivé le 28/04/2026                          │
  └──────────────────────────────────────────────────────┘

Le bouton DL pour les anciennes versions appelle 
GET /api/v1/fichiers/:id/versions/:versionId/download qui :
  - Génère un lien temporaire signé Microsoft Graph (1h)
  - Redirige le navigateur

==============================================================
D. ENDPOINTS API
==============================================================

GET    /api/v1/fichiers/:id/versions
GET    /api/v1/fichiers/:id/versions/:versionId/download
POST   /api/v1/fichiers/:id/restore-version/:versionId
       (ré-importe une ancienne version comme courante, l'actuelle 
        passe en archive)

==============================================================
E. ROBUSTESSE
==============================================================

- Si OneDrive est indisponible → garder le fichier sur S3 dans 
  /archive_pending et retry toutes les 15 min
- Quota OneDrive : monitoring + alerte à 80%
- Checksum SHA-256 vérifié avant et après transfert
- Rapport mensuel : volume archivé, espace libéré sur S3
```

### Critères de validation
- [ ] Upload d'un fichier sur une offre ayant déjà un fichier joint déclenche l'archivage
- [ ] Le fichier est bien sur OneDrive après le job
- [ ] Liste des versions s'affiche correctement
- [ ] Restauration d'une ancienne version fonctionne
- [ ] Si OneDrive down, le fichier reste accessible en S3

---

<a id="phase-9"></a>
## 11. 🔴 PHASE 9 — Génération PDF/Word enrichie (R8, R9, R10)

### Objectif
Compléter les documents générés avec : numéro de commande client sur facture (R8), tableau d'échéancier sur PDF d'offre (R9), valeurs par défaut TVA/consultant (R10).

### 📝 Prompt Cursor à coller

```
Enrichir la génération PDF/Word des offres et factures.

==============================================================
A. PDF FACTURE — Ajout numéro de commande client (R8)
==============================================================

Dans le bandeau d'en-tête de la facture, ajouter sous la référence 
facture (ex. `LVO-F2026-001`) :

  Référence facture : LVO-F2026-001
  Référence commande LVO : 2026-LVO-MOE-006
  >>> N° commande client : CMD-SIDR-2026-0089  <<<  ← NOUVEAU
  Référence offre : LVO-MOE-26009

La valeur vient de `commandes.numero_client` saisi à l'import du PDF 
client.

Modifications à faire :
  1. Frontend : champ obligatoire "N° commande client" dans le 
     formulaire de création de commande
  2. Backend : transmettre cette valeur au générateur PDF/Word
  3. Templates jsPDF et docx.js : ajouter la ligne dans le bandeau

==============================================================
B. PDF OFFRE — Tableau échéancier facturation et exécution (R9)
==============================================================

Avant les zones de signature, ajouter 2 nouveaux tableaux :

  ┌──────────────────────────────────────────────────────────┐
  │ ÉCHÉANCIER DE FACTURATION                                │
  ├──────────────┬─────────────┬───────────────┬─────────────┤
  │ Phase        │ Date prév.  │ Montant HT    │ % du total  │
  ├──────────────┼─────────────┼───────────────┼─────────────┤
  │ ESQ          │ 30/06/2026  │ 3 500 €       │ 12 %        │
  │ APS          │ 30/09/2026  │ 6 000 €       │ 20 %        │
  │ APD          │ 31/12/2026  │ 8 500 €       │ 28 %        │
  │ ...          │ ...         │ ...           │ ...         │
  ├──────────────┴─────────────┼───────────────┼─────────────┤
  │ TOTAL                       │ 30 000 €     │ 100 %       │
  └─────────────────────────────┴───────────────┴─────────────┘

  ┌──────────────────────────────────────────────────────────┐
  │ ÉCHÉANCIER D'EXÉCUTION                                   │
  ├──────────────┬─────────────┬─────────────┬───────────────┤
  │ Phase        │ Début prév. │ Fin prév.   │ Durée (sem.)  │
  ├──────────────┼─────────────┼─────────────┼───────────────┤
  │ ESQ          │ 15/05/2026  │ 30/06/2026  │ 6             │
  │ APS          │ 01/07/2026  │ 30/09/2026  │ 13            │
  │ ...          │ ...         │ ...         │ ...           │
  └──────────────┴─────────────┴─────────────┴───────────────┘

Données :
  - Échéancier facturation : SUM par phase de echeancier_facturation 
    (déjà existant) ou JSON dans offres.echeancier_facturation_json
  - Échéancier exécution : nouvelle structure JSON dans 
    offres.echeancier_execution_json
    [{ phase_code, debut, fin, duree_semaines }]

UI Formulaire offre :
  - Nouvelle section "Planning prévisionnel"
  - Tableau éditable inline (date début, date fin, durée auto-calculée)
  - Génération auto possible : "Calculer à partir de la date de début 
    et des durées standards"

==============================================================
C. VALEURS PAR DÉFAUT (R10)
==============================================================

1. TVA : ajouter une logique dans le formulaire d'offre :
   - Si client.adresse.code_postal commence par 974, 972, 971, 973, 976 
     → TVA par défaut = 8.5% (DOM-TOM)
   - Sinon → 20%
   - Toujours surchargeable manuellement

2. Consultant par défaut :
   - Configurable dans /admin/settings : "Consultant par défaut sur 
     nouvelles offres" (sélecteur)
   - Préselectionner ce consultant dans le formulaire d'offre
   - Selon la fiche : Hatem LEMBARKI → vérifier en BDD si ce 
     consultant existe ; sinon, ajouter à la liste consultants 
     (cf. table users)

==============================================================
D. EXTRACTION DES TEMPLATES
==============================================================

Refactoriser pour avoir des templates réutilisables :

  /templates/
    offre.template.tsx     (composant React Server pour preview)
    offre.pdf.ts           (génération jsPDF)
    offre.docx.ts          (génération docx.js)
    facture.template.tsx
    facture.pdf.ts
    facture.docx.ts
    avoir.template.tsx
    avoir.pdf.ts
    avoir.docx.ts
    
  /templates/components/
    EnTete.tsx             (logo + bandeau marine)
    PiedDePage.tsx         (SIRET, TVA, URL)
    BlocSignatures.tsx
    TableauHonoraires.tsx
    TableauEcheancier.tsx  (nouveau)
    
Tous les composants partagent les mêmes props pour cohérence visuelle.

==============================================================
E. PRÉVIEW EN TEMPS RÉEL
==============================================================

Dans le formulaire d'offre, ajouter un panneau d'aperçu live à droite :
  - Iframe rendant le HTML du template
  - Mise à jour à chaque modification (debounce 500ms)
  - Bouton "Télécharger PDF" / "Télécharger Word" en bas
```

### Critères de validation
- [ ] Numéro commande client visible sur PDF facture
- [ ] Tableaux échéancier facturation + exécution sur PDF offre
- [ ] TVA auto à 8.5% pour adresse DOM-TOM
- [ ] Consultant par défaut configurable et appliqué
- [ ] Preview live fonctionne sans rechargement

---

<a id="phase-10"></a>
## 12. 🌟 PHASE 10 — Bonus IA, OCR, e-signature (B1, B2, B3)

### Objectif
Apporter une touche d'intelligence pour différencier le CRM et accélérer le quotidien.

### 12.1 OCR Bons de Commande (B1)

#### 📝 Prompt Cursor à coller

```
Implémenter l'OCR automatique des bons de commande PDF.

WORKFLOW
1. Le consultant uploade un PDF de bon de commande client
2. Avant d'afficher le formulaire, le PDF est passé à un OCR
3. Le formulaire est PRÉ-REMPLI avec les valeurs extraites
4. Le consultant valide / corrige

STACK
- OCR : Tesseract.js (gratuit, côté serveur Node) OU Google Cloud Vision 
  OU AWS Textract (plus précis)
- Recommandation : commencer avec Tesseract puis basculer si volume

EXTRACTION CIBLÉE
Champs à extraire avec heuristiques (regex + position) :
  - Numéro commande client (regex : CMD-\w+ ou Commande n° \d+)
  - Date commande
  - Montant HT et TTC (avec gestion des formats français : 12 345,67 €)
  - Adresse de facturation (heuristique : bloc après "Adresse facturation")
  - Référence offre LVO (regex : LVO-\w+)

SERVICE
`services/ocr/bon-commande.parser.ts` :
  parseBonCommande(pdfBuffer) → BonCommandeExtracted {
    numeroClient: string | null
    dateCommande: Date | null
    montantHt: number | null
    montantTtc: number | null
    adresseFacturation: string | null
    referenceOffre: string | null
    confidenceScore: number  // 0-1, combien de champs extraits
  }

UX
  - Spinner "Analyse du PDF..." pendant l'extraction
  - Champs pré-remplis avec une icône 🤖 indiquant "Suggéré par IA"
  - Couleur orange si confiance < 0.7 (= à vérifier)
  - Bouton "Effacer toutes les suggestions" pour repartir de zéro

ENDPOINTS
POST /api/v1/ocr/bon-commande  (multipart : pdf)
  → 200 { extracted: BonCommandeExtracted, raw_text: string }
```

### 12.2 IA Assistant suggestion phases (B2)

#### 📝 Prompt Cursor à coller

```
Assistant IA pour suggérer la configuration optimale d'une offre.

TRIGGER
Quand le consultant remplit le formulaire d'offre, après avoir saisi :
  - Type de mission
  - Nombre et type d'appareils
  - Type de bâtiment

→ Bouton "🤖 Suggérer une configuration"

LOGIQUE
Option simple (sans LLM) : règles métier codées
  - Si MCN + ascenseurs + bâtiment hôpital → toutes phases + AOR renforcée
  - Si MOE simple → VISA, DET, AOR uniquement
  - Si bâtiment résidentiel + MCM → ESQ optionnel, APD obligatoire
  - etc.

Option avancée (LLM) : appel à Claude API
  Contexte fourni : 50 dernières offres similaires (même type mission, 
  même type bâtiment) avec leur configuration et statut final 
  (commandée vs refusée)
  Prompt système : "Tu es un assistant ingénieur LVO. Suggère la 
  configuration de phases la plus probable d'aboutir à une commande..."
  Réponse JSON structurée : { phases: [...], rationale: "..." }

RECOMMANDATION
  Démarrer avec l'option simple (règles), passer à LLM si volume 
  d'offres > 200/mois pour rentabiliser le coût d'API.

UI
  - Modal avec :
    - Configuration suggérée
    - Justification courte
    - Bouton "Appliquer" → remplit le formulaire
    - Bouton "Modifier" → applique mais permet l'édition

ENDPOINT
POST /api/v1/ia/suggerer-configuration
  body: { typeMission, nombreAppareils, typeAppareil, typeBatiment }
  response: { phases: [...], rationale: "...", confidence: 0.85 }
```

### 12.3 E-signature intégrée (B3)

#### 📝 Prompt Cursor à coller

```
Intégrer Yousign (français, RGPD) pour la signature électronique des offres 
et bons de commande.

WORKFLOW
1. Sur une offre en statut ENVOYÉE, bouton "✍ Demander signature 
   électronique"
2. Modal :
   - Destinataires : email client (auto-rempli) + email LVO 
     (consultant)
   - Document : PDF auto-généré
   - Date d'expiration : 30j par défaut
3. Validation → appel API Yousign → procédure créée
4. Le client reçoit un email Yousign, signe en ligne
5. Webhook Yousign → CRM met à jour le statut :
   - Si signé par tous → statut COMMANDÉE + PDF signé stocké S3
   - Si refusé → statut REFUSÉE + motif
   - Si expiré → notification au consultant

STACK
  - SDK Yousign V3 (npm: @yousign/yousign-rest-api-v3)
  - Webhook endpoint : POST /api/v1/webhooks/yousign

ENV
  YOUSIGN_API_KEY
  YOUSIGN_WEBHOOK_SECRET
  YOUSIGN_API_BASE_URL=https://api.yousign.app/v3

ENDPOINTS
  POST /api/v1/offres/:id/demander-signature
  POST /api/v1/webhooks/yousign
  GET  /api/v1/offres/:id/signature-status

UI
  - Badge "✍ En attente de signature" sur la fiche offre
  - Timeline : envoyé → vu → signé/refusé
  - Bouton "📥 Télécharger PDF signé" une fois finalisé

ALTERNATIVE
  Si Yousign trop cher : DocuSign (US, plus connu) ou solution open-source 
  comme DocuSeal.
```

### 12.4 Recherche globale Cmd+K (B7)

#### 📝 Prompt Cursor à coller

```
Implémenter une recherche globale type Linear/Notion (Cmd+K).

UX
  - Raccourci Cmd+K (Mac) / Ctrl+K (Windows) ouvre une palette modale
  - Barre de recherche en haut, résultats catégorisés en dessous
  - Catégories : Offres, Commandes, Factures, Clients, Contacts, Sites, 
    Consultants
  - Affichage : icône + titre + sous-titre + référence
  - Flèches haut/bas pour naviguer, Entrée pour ouvrir
  - Esc pour fermer

BACKEND
  - Endpoint POST /api/v1/search
  - Body : { q: string, categories?: string[], limit?: number }
  - Response : { results: SearchResult[] }
  - SearchResult : { id, type, title, subtitle, url, score }

IMPLÉMENTATION
Option simple : ILIKE sur PostgreSQL (jusqu'à ~10000 entités)
Option scalable : full-text search avec tsvector + tsquery
  CREATE INDEX idx_offres_search ON offres USING gin(
    to_tsvector('french', reference || ' ' || coalesce(description, ''))
  );
  
Pour très gros volumes : Meilisearch ou Algolia

UI
  - Composant React `<GlobalSearch>` avec keyboard shortcut hook
  - Debounce 200ms
  - Caching local des dernières recherches (LRU)
  - Recherches récentes en cas de palette ouverte sans saisie
```

### Critères de validation
- [ ] OCR extrait au moins 4/5 champs sur 80% des PDF testés
- [ ] Suggestion IA propose une config cohérente sur 5 cas types
- [ ] E-signature : workflow complet testé en sandbox Yousign
- [ ] Cmd+K répond en < 200ms

---

<a id="phase-11"></a>
## 13. 🛡 PHASE 11 — Sécurité, audit, RGPD

### 📝 Prompt Cursor à coller

```
Renforcer la sécurité, l'audit et la conformité RGPD.

==============================================================
A. AUDIT LOG GLOBAL
==============================================================

Table audit_log :
  id UUID PK
  performed_by UUID FK -> users(id)
  performed_at TIMESTAMPTZ DEFAULT NOW()
  ip_address INET
  user_agent TEXT
  http_method VARCHAR(10)
  endpoint TEXT
  entity_type VARCHAR(50)
  entity_id UUID
  action VARCHAR(50)  -- CREATE, UPDATE, DELETE, LOGIN, EXPORT, etc.
  changes JSONB  -- diff before/after pour UPDATE
  metadata JSONB

Implémenter via :
  - Middleware NestJS qui intercepte toutes les routes
  - Décorateur @Audit({entity, action}) pour les actions métier
  - Filtre Prisma pour automatiquement logger les UPDATE/DELETE

Page admin /admin/audit :
  - Filtres : utilisateur, type entité, action, dates, IP
  - Recherche full-text
  - Export CSV
  - Visualisation diff JSON pour UPDATE

==============================================================
B. EXPORT RGPD
==============================================================

Endpoints :
  GET /api/v1/rgpd/export/contact/:id  → JSON complet du contact + 
                                          toutes ses données liées
  POST /api/v1/rgpd/anonymize/contact/:id  → ADMIN, anonymisation 
                                              irréversible

Page utilisateur (pour les contacts ayant un compte plateforme) :
  /mon-compte/mes-donnees → bouton "Exporter mes données" + 
                            "Demander suppression"

==============================================================
C. MFA OBLIGATOIRE (renforcement)
==============================================================

  - MFA TOTP obligatoire pour ADMIN et MANAGER (déjà spec)
  - À l'activation : QR code + 10 codes de récupération à imprimer
  - Désactivation MFA = impossible sans intervention support

==============================================================
D. RATE LIMITING avancé
==============================================================

  - 5 tentatives login échouées en 5 min → blocage IP 1h
  - 100 req/min par utilisateur authentifié
  - 1000 req/min par IP (anti-DDoS)
  - Endpoints sensibles (création offre, facture) : 10 req/min

==============================================================
E. CSP, HSTS, headers sécurité
==============================================================

middleware Helmet.js avec :
  Content-Security-Policy strict (nonce sur scripts inline)
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()

==============================================================
F. CHIFFREMENT DES CHAMPS SENSIBLES
==============================================================

Champs à chiffrer côté application (AES-256-GCM) :
  - users.refresh_token
  - oauth_tokens.access_token, refresh_token
  - paiements.iban_emetteur (si stocké)
  
Clé de chiffrement gérée par AWS KMS / HashiCorp Vault.

==============================================================
G. DPA & SOUS-TRAITANTS
==============================================================

Page publique /legal/sous-traitants :
  Liste des sous-traitants RGPD avec :
    - Nom (AWS, SendGrid, Yousign, Microsoft, Quonto)
    - Type de données traitées
    - Localisation
    - DPA signé (lien)
```

### Critères de validation
- [ ] Audit log capture toutes les actions sensibles
- [ ] Export RGPD complet en moins de 10s
- [ ] MFA forcé pour ADMIN à la connexion
- [ ] Score sécurité Mozilla Observatory > A
- [ ] Pentest interne réalisé sans faille critique

---

<a id="phase-12"></a>
## 14. ✅ PHASE 12 — Tests & Déploiement

### 📝 Prompt Cursor à coller

```
Mettre en place une stratégie de test complète avant la mise en production.

==============================================================
A. TESTS UNITAIRES (cible 80% couverture)
==============================================================

Cibles prioritaires :
  - reference.service.ts (génération atomique)
  - reconciliation.service.ts (scoring Quonto)
  - cancellation.service.ts (avoirs)
  - permissions.guard.ts (RBAC)

Stack : Jest + ts-jest + supertest pour endpoints

==============================================================
B. TESTS D'INTÉGRATION
==============================================================

  - Test E2E avec base de test PostgreSQL en Docker
  - Scénarios :
    1. Création complète : contact → client → site → offre → 
       commande → facture → paiement Quonto → recouvrement
    2. Annulation commande avec avoirs
    3. Duplication offre avec révision
    4. Multi-gestionnaires sur un site

==============================================================
C. TESTS E2E FRONTEND
==============================================================

Stack : Playwright

Scénarios :
  - Login + MFA
  - Création offre via UI
  - Cmd+K recherche
  - Upload PDF + OCR
  - Génération PDF/Word
  - Mode hors ligne (PWA)

==============================================================
D. TESTS DE CHARGE
==============================================================

Stack : k6 ou Artillery

Cibles :
  - 100 utilisateurs simultanés
  - Création concurrente de 50 offres → vérifier unicité des 
    références
  - Liste de 1000 offres → temps de réponse < 500ms

==============================================================
E. CI/CD
==============================================================

GitHub Actions / GitLab CI :
  - Lint (ESLint + Prettier)
  - Type check (tsc --noEmit)
  - Tests unitaires
  - Tests intégration (avec PostgreSQL service)
  - Build
  - Déploiement staging auto sur merge develop
  - Déploiement prod manuel après validation staging

==============================================================
F. MONITORING & OBSERVABILITÉ
==============================================================

  - Sentry pour errors (frontend + backend)
  - Datadog ou Grafana + Prometheus pour métriques
  - Healthcheck endpoints :
    GET /health (liveness)
    GET /health/ready (readiness avec checks BDD, S3, Quonto, 
                       OneDrive)
  - Logs structurés (JSON) avec corrélation request-id

==============================================================
G. SAUVEGARDES
==============================================================

  - PostgreSQL : pg_dump quotidien + WAL archiving + PITR
  - Conservation : 30j quotidien, 12 mois mensuel, 7 ans annuel 
    (légal)
  - Test de restauration mensuel obligatoire
  - S3 : versioning activé + cross-region replication

==============================================================
H. CHECKLIST GO-LIVE
==============================================================

- [ ] Toutes les variables ENV de production configurées
- [ ] Certificats SSL valides (Let's Encrypt auto-renouvellement)
- [ ] DNS configuré (crm.lvo-ingenierie.fr)
- [ ] Email de notification configuré (SendGrid)
- [ ] Quonto en mode production (et non sandbox)
- [ ] OneDrive Azure AD app validée
- [ ] Yousign en mode production
- [ ] Backup testé et restauration vérifiée
- [ ] Monitoring opérationnel
- [ ] Documentation utilisateur à jour
- [ ] Formation équipe LVO réalisée
- [ ] Plan de rollback documenté
```

### Critères de validation
- [ ] Couverture tests > 80%
- [ ] Tests E2E passent en moins de 5 min
- [ ] Tests de charge OK pour pic prévu
- [ ] Sentry capture erreurs en staging
- [ ] Restauration backup testée

---

<a id="annexe-a"></a>
## 15. 📋 ANNEXE A — Prompt « META » initial pour Cursor

À coller en premier à Cursor pour le mettre dans le bon contexte avant toute phase.

```
Tu travailles sur le CRM LVO Ingénierie, une application web pour un bureau 
d'études en mobilité verticale (ascenseurs, escaliers mécaniques).

CONTEXTE
- Application accessible à https://crm.lvo-ingenierie.fr
- Stack : React 18 + Tailwind (frontend, ex. Next.js), backend selon dépôt 
  (NestJS + Prisma + PostgreSQL 15 si présent), Redis (cache), AWS S3 (fichiers)
- Multi-agences : Paris (75), La Réunion (89), Lyon (92), Sophia-Antipolis 
  (94)
- 4 rôles : ADMIN, MANAGER, CONSULTANT, VIEWER
- Tu dois respecter strictement la fiche technique CRM v4.0 fournie.

RÈGLES DE TRAVAIL
1. Avant toute modification, lis le fichier impacté en entier.
2. Ne casse jamais une fonctionnalité existante : ajoute des tests 
   de non-régression.
3. Toute migration de BDD doit être réversible (down().sql obligatoire).
4. Tout endpoint sensible doit vérifier les permissions par rôle.
5. Les commits sont atomiques et nommés selon Conventional Commits 
   (feat:, fix:, refactor:, docs:, test:).
6. Documente les choix non triviaux dans un commentaire ou un ADR 
   (Architecture Decision Record) dans /docs/adr/.
7. Si une spec est ambiguë, POSE UNE QUESTION avant d'implémenter.

ÉTAPE PAR ÉTAPE
Je vais te donner les phases dans l'ordre. Pour chaque phase :
1. Tu lis la spec
2. Tu poses tes questions si besoin
3. Tu produis un plan d'attaque (fichiers à créer/modifier)
4. Tu attends mon "GO" 
5. Tu implémentes
6. Tu écris les tests
7. Tu lances les tests
8. Tu fais un récapitulatif des changements

Prêt ? La première phase à traiter est : [PHASE 0 — Audit du code existant].
```

---

<a id="annexe-b"></a>
## 16. ✅ ANNEXE B — Checklist de validation finale

### 🎯 Éléments rouges du PDF

- [ ] **R1** Module Recouvrement opérationnel + icône sidebar
- [ ] **R2** Connexion Quonto fonctionnelle (rapprochement auto)
- [ ] **R3** Sites avec gestionnaire(s) multiples
- [ ] **R4** Format référence : `LVO-MOE-26009`, `2026-LVO-MOE-006`, `LVO-F2026-001`
- [ ] **R5** Sélection partielle des phases par mission
- [ ] **R6** Avoirs auto-générés sur annulation commande
- [ ] **R7** Versioning fichiers vers OneDrive
- [ ] **R8** N° commande client visible sur facture
- [ ] **R9** Tableaux échéancier facturation + exécution sur PDF offre
- [ ] **R10** TVA défaut 20% / 8.5% DOM-TOM + consultant par défaut
- [ ] **R11** Annulation contacts et clients (soft delete)
- [ ] **R12** Suppression contacts/clients/sites avec règles + modification

### 🌟 Bonus features livrées

- [ ] OCR bons de commande
- [ ] Suggestion IA des phases
- [ ] E-signature Yousign
- [ ] Recherche globale Cmd+K
- [ ] Webhooks sortants
- [ ] PWA mode hors-ligne
- [ ] Bulk actions
- [ ] Audit log viewer
- [ ] Import Excel
- [ ] Notifications Slack/Teams
- [ ] Dashboard personnalisable
- [ ] Prévisions trésorerie

### 🛡 Sécurité & Conformité

- [ ] MFA obligatoire pour ADMIN/MANAGER
- [ ] Audit log complet
- [ ] Export RGPD opérationnel
- [ ] Anonymisation après 3 ans
- [ ] HSTS + CSP stricts
- [ ] Tokens chiffrés en BDD
- [ ] DPA sous-traitants à jour

### 📊 Performance

- [ ] Liste 1000 offres < 500ms
- [ ] Génération PDF < 1s
- [ ] OCR < 3s
- [ ] Recherche globale < 200ms
- [ ] Lighthouse score > 90

### 🚀 Déploiement

- [ ] CI/CD opérationnel
- [ ] Monitoring Sentry + Datadog
- [ ] Backups testés
- [ ] Documentation utilisateur
- [ ] Formation équipe LVO

---

## 📞 NOTES IMPORTANTES

1. **Ordre d'exécution recommandé** : Phase 0 → 1 → 2 → 3 → 4 → 5 → 9 → 6 → 7 → 8 → 10 → 11 → 12. Les phases P0 (rouges) en premier.

2. **Itération avec Cursor** : ne donne JAMAIS toutes les phases d'un coup. Une phase à la fois, valide, commit, puis suivante.

3. **Rollback** : chaque phase doit être déployable indépendamment (feature flags si besoin).

4. **Communication équipe** : informer Hugues, Karim, Hatem, etc. avant chaque mise en production majeure.

5. **Documentation** : à chaque phase, mettre à jour `/docs/` (README, API, ADR).

---

**Document préparé pour transformation par Cursor AI** · Mai 2026 · v1.0
