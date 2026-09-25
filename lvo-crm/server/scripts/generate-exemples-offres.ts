/**
 * Génère des offres d'exemple (.docx, et .pdf si Gotenberg répond) pour chaque type de mission
 * outillé, adressées tour à tour à une destinataire et à un destinataire — pour vérifier la formule
 * d'appel et la salutation finale (« Madame, » / « Monsieur, »).
 *
 * Usage (depuis lvo-crm/server) : npx tsx scripts/generate-exemples-offres.ts
 * Sortie : lvo-crm/exemples-generes-offres/Offre-<TYPE>-<Madame|Monsieur>.docx
 *
 * Toutes les données (clients, sites, personnes) sont fictives.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildMoeMissionBody, civiliteAppel, getMissionBody, MISSION_LABELS, type MissionBody } from "../src/documents/offre-content.js";
import { renderOffreDocx, type OffreRenderData } from "../src/documents/offre-docx.js";
import { convertDocxToPdf } from "../src/documents/gotenberg.js";
import { htmlToBlocks } from "../src/documents/offre-html-blocks.js";
import { computeOffreFromMissionCalc } from "../src/documents/offre-mission-calc.js";
import { crmAppSettings } from "../src/store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "..", "..", "exemples-generes-offres");

type TypeMission = "A" | "CTQ" | "MM" | "MOE" | "MS";
type Destinataire = { civilite: string; prenom: string; nom: string; fonction: string };

type Exemple = {
  type: TypeMission;
  numero: string;
  siteNom: string;
  siteAdresse: string;
  clientNom: string;
  clientDirection: string;
  gestionnaireNom?: string;
  madame: Destinataire;
  monsieur: Destinataire;
  missionCalc: unknown;
};

const DATE_OFFRE = "2026-09-21";

const phase = (code: string, patch: Record<string, unknown>) => ({
  code,
  selected: true,
  calcMode: "LIBRE",
  montantHt: 0,
  prixUnitaireHt: 0,
  nbAscenseurs: 2,
  pourcentage: 7,
  echeancierTexte: "",
  delaiTexte: "",
  ...patch,
});

const EXEMPLES: Exemple[] = [
  {
    type: "A",
    numero: "LVO-audit-26101",
    siteNom: "Résidence Les Flamboyants",
    siteAdresse: "12 rue des Lataniers, 97400 Saint-Denis",
    clientNom: "SHLMR",
    clientDirection: "Direction du Patrimoine",
    madame: { civilite: "Mme", prenom: "Nathalie", nom: "HOARAU", fonction: "Responsable technique" },
    monsieur: { civilite: "M.", prenom: "Olivier", nom: "PAYET", fonction: "Responsable technique" },
    missionCalc: { prixUnitaireHt: 750, nbAscenseurs: 3 },
  },
  {
    type: "CTQ",
    numero: "LVO-CTQ-26102",
    siteNom: "Immeuble Le Barachois",
    siteAdresse: "4 boulevard Gabriel Macé, 97400 Saint-Denis",
    clientNom: "SIDR",
    clientDirection: "Direction de la Maintenance",
    gestionnaireNom: "GERER IMMOBILIER",
    madame: { civilite: "Mme", prenom: "Sophie", nom: "GRONDIN", fonction: "Chargée d'opérations" },
    monsieur: { civilite: "M.", prenom: "Julien", nom: "RIVIÈRE", fonction: "Chargé d'opérations" },
    missionCalc: { prixUnitaireHt: 350, nbAscenseurs: 1 },
  },
  {
    type: "MM",
    numero: "LVO-MM-26103",
    siteNom: "Centre administratif du Port",
    siteAdresse: "20 avenue du 14 Juillet 1789, 97420 Le Port",
    clientNom: "Commune du Port",
    clientDirection: "Direction des Services Techniques",
    madame: { civilite: "Mme", prenom: "Isabelle", nom: "TECHER", fonction: "Directrice des services techniques" },
    monsieur: { civilite: "M.", prenom: "Laurent", nom: "FONTAINE", fonction: "Directeur des services techniques" },
    missionCalc: { prixUnitaireMoisHt: 45, nbAscenseurs: 6 },
  },
  {
    type: "MOE",
    numero: "LVO-MOE-26104",
    siteNom: "Hôtel de Région",
    siteAdresse: "Avenue René Cassin, 97490 Sainte-Clotilde",
    clientNom: "Région Réunion",
    clientDirection: "Direction du Patrimoine Immobilier",
    madame: { civilite: "Mme", prenom: "Claire", nom: "BÈGUE", fonction: "Cheffe de projet" },
    monsieur: { civilite: "M.", prenom: "Thomas", nom: "LAURET", fonction: "Chef de projet" },
    missionCalc: {
      phases: [
        phase("AVANT_PROJET", { montantHt: 3500, echeancierTexte: "À la remise de l'avant-projet", delaiTexte: "4 semaines" }),
        phase("DCE_AMT", { montantHt: 4800, echeancierTexte: "50 % à la remise du DCE\n50 % à la remise de l'AMT", delaiTexte: "6 semaines" }),
        // DET au pourcentage du montant des travaux : 7 % × 180 000 € HT.
        phase("DET", {
          calcMode: "POURCENTAGE",
          montantTravauxHt: 180000,
          echeancierTexte: "Mensuellement, au prorata de l'avancement des travaux",
          delaiTexte: "suivant planning du Maître d'Ouvrage",
        }),
        phase("GPA", { montantHt: 1200, echeancierTexte: "À la levée des réserves", delaiTexte: "12 mois" }),
      ],
    },
  },
  {
    type: "MS",
    numero: "LVO-MS-26105",
    siteNom: "CHU Félix Guyon",
    siteAdresse: "Allée des Topazes, 97400 Saint-Denis",
    clientNom: "CHU de La Réunion",
    clientDirection: "Direction des Travaux et du Patrimoine",
    madame: { civilite: "Mme", prenom: "Valérie", nom: "MAILLOT", fonction: "Ingénieure travaux" },
    monsieur: { civilite: "M.", prenom: "Frédéric", nom: "HOAREAU", fonction: "Ingénieur travaux" },
    missionCalc: {
      texteMissionHtml:
        "<h3>Phase : Assistance aux opérations de réception</h3><ul>" +
        "<li>Participation aux essais de réception des 4 ascenseurs rénovés</li>" +
        "<li>Vérification de la conformité aux pièces du marché</li>" +
        "<li>Rédaction du procès-verbal et de la liste des réserves</li></ul>",
      montantHt: 2400,
      echeancierTexte: "100 % à la remise du procès-verbal",
      delaiTexte: "Selon planning du maître d'ouvrage",
    },
  },
];

function formatDateFr(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

/** Reprend la logique de buildOffreRenderData (routes/crm.ts) sans passer par le store. */
function buildRenderData(ex: Exemple, dest: Destinataire): OffreRenderData {
  const calc = computeOffreFromMissionCalc(ex.type, ex.missionCalc, DATE_OFFRE);
  if (!calc.ok) throw new Error(`${ex.type} : ${calc.error}`);

  let missionBody: MissionBody | null = getMissionBody(ex.type);
  if (ex.type === "MOE") {
    const phases = (ex.missionCalc as { phases: { code: string; selected: boolean }[] }).phases;
    missionBody = buildMoeMissionBody(phases.filter((p) => p.selected).map((p) => p.code));
  } else if (ex.type === "MS") {
    missionBody = { type: "MS", libelle: "Mission Spéciale", blocks: htmlToBlocks((ex.missionCalc as { texteMissionHtml: string }).texteMissionHtml) };
  }

  const honoraires = (JSON.parse(calc.phasesLinesJson) as { libelle: string; montantHt: number }[]).map((l) => ({
    libelle: l.libelle,
    montant: l.montantHt,
  }));
  const dateFr = formatDateFr(DATE_OFFRE);
  return {
    reference: ex.numero,
    typeMission: ex.type,
    dateOffre: dateFr,
    courrierVilleDate: `Saint-Denis, le ${dateFr}`,
    siteNom: ex.siteNom,
    siteAdresse: ex.siteAdresse,
    sitePhoto: null,
    clientNom: ex.clientNom,
    clientDirection: ex.clientDirection,
    clientRepresentant: `${dest.civilite} ${dest.prenom} ${dest.nom} (${dest.fonction})`,
    gestionnaireNom: ex.gestionnaireNom ?? null,
    civiliteAppel: civiliteAppel(dest.civilite),
    missionLabel: MISSION_LABELS[ex.type] ?? ex.type,
    objet: `${ex.siteNom} - ${ex.siteAdresse}`,
    honoraires,
    totalHt: calc.montantHt,
    echeancier: JSON.parse(calc.echeancierRowsJson),
    delais: calc.delaisLignesJson ? JSON.parse(calc.delaisLignesJson) : [],
    tva: 8.5,
    validite: "3 mois",
    coutHoraire: crmAppSettings.coutHoraireHt,
    coutJournalier: crmAppSettings.coutJournalierHt,
    missionBody,
    mmHonoraires: calc.mmDetail,
    auditHonoraires: calc.auditDetail,
  };
}

const TYPE_FICHIER: Record<TypeMission, string> = { A: "AUDIT", CTQ: "CTQ", MM: "MM", MOE: "MOE", MS: "MS" };

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let pdfDisponible = true;
  for (const ex of EXEMPLES) {
    for (const [genre, dest] of [["Madame", ex.madame], ["Monsieur", ex.monsieur]] as const) {
      const base = `Offre-${TYPE_FICHIER[ex.type]}-${genre}`;
      const docx = await renderOffreDocx(buildRenderData(ex, dest));
      fs.writeFileSync(path.join(OUT_DIR, `${base}.docx`), docx);
      let pdfNote = "";
      if (pdfDisponible) {
        try {
          fs.writeFileSync(path.join(OUT_DIR, `${base}.pdf`), await convertDocxToPdf(docx, `${base}.docx`));
          pdfNote = " + .pdf";
        } catch {
          pdfDisponible = false;
          console.warn("Gotenberg injoignable : génération des .docx uniquement.");
        }
      }
      console.log(`${base}.docx${pdfNote} — ${dest.civilite} ${dest.prenom} ${dest.nom}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
