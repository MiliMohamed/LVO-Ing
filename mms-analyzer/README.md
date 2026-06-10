# MMS Analyzer — Maintenance ascenseurs (LVO-Ingénierie)

Application **Python + Streamlit** pour analyser les données brutes de maintenance ascenseurs et produire :

1. **Tableau MMS** (Excel, 6 feuilles)
2. **Compte-rendu trimestriel** (Word)

## Installation

```bash
cd mms-analyzer
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
```

## Lancement

### Dans le CRM (recommandé)

1. Terminal 1 — API Python : `npm run mms:api` (à la racine `lvo-web`)
2. Terminal 2 — CRM : `npm run frontend:dev`
3. CRM → sidebar **Documents & flux** → **Maintenance ascenseurs (MMS)**  
   URL : `/crm/outils/maintenance-mms`

L’upload du fichier brut lance l’analyse automatiquement.

### Interface Streamlit seule

```bash
streamlit run app.py
```

## Structure

| Fichier | Rôle |
|---------|------|
| `app.py` | Interface Streamlit |
| `core/parser.py` | Lecture Excel, détection en-têtes, parseur heures/dates |
| `core/calculs.py` | Durées, classements, pénalités |
| `core/export_excel.py` | Tableau MMS |
| `core/export_word.py` | Compte-rendu docxtpl |
| `config/parametres.py` | Seuils et tarifs par défaut |
| `templates/CR_modele.docx` | Créé automatiquement au premier export Word |

## Formats d'entrée

| Format | Feuilles | Détection |
|--------|----------|-----------|
| **Annexe 5** | 4 feuilles (Intervention, Maintenance, Parachute, Câbles) | défaut |
| **OTIS SCI** | 3 feuilles (`Demandes d'intervention`, `Opération de maintenance`, `Appareil à l'arrêt`) | automatique |

Ex. `Q1 SCI CADJEE.xls` : format OTIS SCI — durées en minutes utilisées telles quelles, dédoublonnage maintenance par (appareil, date d'arrivée).

## Validation CADJEE/OTIS

Sur `Q1 SCI CADJEE.xls` (T1, seuils annuels par défaut) :

- Pénalité totale attendue : **3 200 – 3 700 €** (±10 % du CR de référence)
- Immobilisation et pannes : **0 €** au T1 (indicateurs seuls)
- 7 tests parachute détectés (variantes « essai / test parachute »)

```bash
cd mms-analyzer
.venv\Scripts\python.exe -m pytest tests/test_cadjee_otis_t1.py -v
.venv\Scripts\python.exe scripts/valider_otis.py
```

Placez le fichier de test dans `tests/fixtures/Q1_SCI_CADJEE.xls` ou définissez `MMS_FIXTURE_CADJEE`.

## Extensions v3

- **PDF** : généré automatiquement si Word ou LibreOffice est installé (`docx2pdf` sur Windows).
- **Cartographie** : carte `carte_penalites.png` (géocodage Nominatim + repli La Réunion).
- **Lot CRM** : panneau « Traiter tous les fichiers » avec barre de progression (`POST /analyze-batch-stream`).
- **GHER consolidé** : Word/PDF comparatif dès que 2+ prestataires sont analysés dans un lot.

## Entrées attendues

- **Obligatoire** : classeur prestataire `.xlsx` (4 feuilles)
- **Optionnel** : liste du parc (Ascenseur, Client, Résidence)
