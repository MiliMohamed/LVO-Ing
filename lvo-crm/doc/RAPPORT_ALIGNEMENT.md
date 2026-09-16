# Rapport d'alignement — Offre de Service LVO vs trames de référence

Comparaison des documents générés par le CRM avec les 4 trames réelles de `lvo-crm/doc/`
(`LVO-audit-26050`, `LVO-MM-26035_CHM`, `LVO-MOE-26026`, `LVO-MS-26037`).

> **Note sur la SPEC** — `doc/SPEC_TRAMES_LVO.md` n'était pas présent dans le dépôt (non joint).
> Toutes les valeurs ci-dessous ont donc été **relevées directement dans le XML des `.docx`**
> (`word/document.xml`, `word/styles.xml`), jamais estimées d'après un rendu PDF.

---

## Étape 1 — Mécanisme de génération (état des lieux)

| Point | Constat |
|---|---|
| Mode | **(b) Construction programmatique** — aucun `.docx` modèle, aucun placeholder |
| Librairie | **`docx` v9.7.1** (npm), seule dépendance de génération Word |
| Conversion PDF | Gotenberg (LibreOffice headless), `server/src/documents/gotenberg.ts` |
| Versionnage | `server/src/documents/offre-versioning.ts` — **non modifié** |
| Où vivaient les styles | Dispersés en dur dans `offre-docx.ts` (couleurs, tailles, pas de largeurs) |

### Décision sur la stratégie (Étape 2)

La consigne proposait de repartir des `.docx` originaux comme modèles (docxtemplater). **Cette voie
a été écartée**, pour des raisons techniques dirimantes :

1. **Images variables** — chaque offre embarque la photo du site (variable, base64 en base) et le
   cachet LVO. L'insertion d'images dans docxtemplater passe par un module dédié qui n'est pas
   dans le paquet open-source de base.
2. **Texte riche libre (Mission Spéciale)** — le corps MS provient d'un éditeur Quill (HTML) et doit
   être converti en runs Word ; même problème de module.
3. **Structure variable (MOE)** — le corps change selon les phases cochées (4 combinaisons × blocs
   de texte différents), ce qui dépasse la simple boucle de lignes de tableau.

La voie retenue est donc : **garder la génération programmatique et aligner le rendu au DXA près**
sur les valeurs relevées dans les trames. Le résultat est vérifié ci-dessous par comparaison XML.

---

## Étape 3 — Tokens de design (source unique)

Nouveau module **`server/src/documents/offre-design.ts`**. Toutes les couleurs, tailles, largeurs,
bordures et marges y sont centralisées ; le renderer n'écrit plus aucune valeur en dur.

| Famille | Valeurs |
|---|---|
| Couleurs | navy `#1A2B4C` · orange `#FF6B00` · orangeAccent `#EA4E00` · texte `#333333` · muted `#8E9DAE` |
| Fonds | `#E8EDF4` · `#EEF2F7` · `#FAFBFC` · `#F4F6F9` · `#FFF3E8` · `#FFFFFF` |
| Police | Arial partout (y compris style par défaut du document) |
| Tailles | cellules `sz19` (9,5 pt) · montants forts `sz22` (11 pt) · notes `sz18` (9 pt) · Titre1 `sz26` (13 pt) · Titre2 `sz22` (11 pt) · bannière `sz36` · nom de site `sz32` · en-tête/pied `sz16` |
| Tableaux | filets `single sz1 #8E9DAE` · `tcMar` 100/150 DXA · `vAlign center` |
| Titre1 | navy gras 13 pt + filet bas `single sz6 #FF6B00` |

Couleurs résiduelles `#002060` / `#333399` / `#17365D` : **absentes du code généré** (vérifié par
grep). `#002060` n'apparaissait que dans la trame MM (un montant saisi à la main) — non reproduit.

---

## Étape 4/5 — Écarts trouvés et corrigés

| # | Écart constaté | Correction |
|---|---|---|
| 1 | Tableaux sans filets définis → hairlines noires par défaut de `docx` | Filets `single sz1 #8E9DAE` sur toutes les cellules |
| 2 | Aucune marge interne de cellule | `tcMar` 100/150 DXA partout |
| 3 | Aucun alignement vertical | `vAlign center` sur toutes les cellules de données |
| 4 | Largeurs de colonnes en % (50/50) | **Largeurs DXA exactes, par type de mission** (voir tableau ci-dessous) |
| 5 | Bannière OFFRE, encadré SITE, encart coût = paragraphes ombrés | Convertis en **tableaux 1×1** avec filets et marges des trames |
| 6 | Encadré SITE sans bordure | Filet navy `sz6` sur les 4 côtés |
| 7 | Bannière OFFRE sans bordure ni marges | Filet orange `sz6`, marges 160/300 DXA |
| 8 | Encart coût : TVA et validité **hors** de l'encart | Les 3 lignes sont désormais **dans la même cellule** `#F4F6F9` |
| 9 | Titre2 (« Tableau de l'offre », « Échéancier de facturation », « Introduction ») en **orange** | **navy gras 11 pt** (conforme au style `Titre2` de `styles.xml`) |
| 10 | Titre1 en 14 pt | **13 pt** (`sz26`, valeur réelle du style `Titre1`) |
| 11 | Ligne TOTAL : les 2 cellules en orange | Libellé sur **fond blanc, texte gris non gras** ; montant seul en **orange/blanc gras 11 pt** |
| 12 | Ligne TOTAL de l'échéancier : colonne 3 vide sans fond | Colonne 1 **navy/blanc**, colonne 2 **orange/blanc**, colonne 3 **`#F4F6F9`** |
| 13 | Tableau de signatures à 2 colonnes | **3 colonnes 4252/320/4490**, colonne centrale **sans aucun filet**, 6 lignes, cachet dans la dernière cellule |
| 14 | Encarts de délai en bleu clair italique | **Encadré pêche `#FFF3E8` à filet orange** (sz12 haut/bas, sz4 gauche/droite), titre + valeur **dans la même case** comme dans Audit/MS |
| 15 | Corps de texte non justifié | **`jc=both`** (justifié), comme les trames |
| 16 | Ligne « Détail des prestations retenues » | **Supprimée** — n'existe dans aucune trame |
| 17 | MM : délai de contrat mis en encadré | **Paragraphe simple** — la trame MM ne l'encadre pas (contrairement à Audit/MS) |

### Largeurs de colonnes par type (DXA) — relevées trame par trame

| Type | Honoraires | Échéancier | Délais |
|---|---|---|---|
| Audit / CTQ | 5155 / 3871 | 3685 / 1739 / 3602 | 2816 / 6210 |
| MM | 4855 / 4171 | 3664 / 1577 / 3785 | 2608 / 6418 |
| MOE | 6215 / 2811 | 4110 / 1556 / 3547 | 3972 / 5054 |
| MS | 6898 / 2128 | 4646 / 1490 / 2890 | 2053 / 6973 |

Communs : bloc POUR `2551 / 6787`, signatures `4252 / 320 / 4490`, largeur utile `9026`.

---

## Étape 6 — Vérification

Un exemple généré par type (Audit, CTQ, MM, MOE 4 phases, MS), avec un jeu de données complet
(client, site, adresse, photo, représentant), converti en PDF et comparé au XML de sa trame avec
le même extracteur de géométrie.

**Résultat pour MM (tableau par tableau, généré vs trame) :**

```
généré : 9026 | 9026 | 9338 [2551,6787] | 9026 | 9026 [4855,4171] | 9026 | 9026 [3664,1577,3785] | 9026 [2608,6418] | 9062 [4252,320,4490]
trame  : 9026 | 9026 | 9338 [2551,6787] | 9026 | 9026 [4855,4171] | 9026 | 9026 [3664,1577,3785] | 9026 [2608,6418] | 9062 [4252,320,4490]
```

Cellule par cellule sur le tableau d'honoraires MM : fonds, filets (`single sz1 #8E9DAE`), marges
(100/150), `vAlign center`, police (Arial), tailles (`sz19`/`sz22`), couleurs et graisses **identiques**.

### Écarts résiduels assumés

| Écart | Raison |
|---|---|
| `tblCellMar` de table (left/right = 10 DXA) absent | Les marges par cellule (`tcMar` 100/150) sont définies explicitement et les surchargent — sans effet visuel. |
| Pagination différente des trames | Les trames sont des documents réels avec leur propre volume de texte ; le nombre de pages suit le contenu de chaque offre. |
| Sous-titres du corps non indentés | Dans les trames l'indentation vient de tabulations saisies à la main dans le texte, pas d'une propriété de paragraphe. |
| Coquilles des trames non reproduites | Ex. `connaitre`, `l'envoie`, `DELAIS` sans accent, montant en `#002060` : corrigées côté CRM (orthographe et charte), non répliquées. |

---

## Fichiers modifiés

| Fichier | Rôle |
|---|---|
| `server/src/documents/offre-design.ts` | **Nouveau** — source unique des tokens de design |
| `server/src/documents/offre-docx.ts` | Renderer : géométrie des tableaux, encadrés, titres, justification |
| `server/src/documents/offre-content.ts` | Texte des trames (MOE verbatim, casse des titres, MM sans encadré) |
| `server/src/routes/crm.ts` | Transmet `typeMission` au renderer (choix des largeurs de colonnes) |

Aucune modification du schéma de données, des routes, de la numérotation ni du versionnage.
