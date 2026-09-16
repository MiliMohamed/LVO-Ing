/**
 * Contenu figé de l'offre de service (courrier type, CGV, corps de mission) — porté depuis
 * la bibliothèque de contenu déjà rédigée pour le POC Spring Boot (backend/.../documents/content/),
 * texte lui-même transcrit du gabarit `Modele_Offre_LVO.pdf` fourni. Aucun nouveau texte inventé.
 */

export type RichRun = { text: string; bold?: boolean; italic?: boolean };

export type ContentBlock =
  | { type: "heading"; text: string }
  | { type: "subheading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "bullet"; text: string }
  | { type: "subbullet"; text: string }
  | { type: "boxed"; text: string }
  /** Encart mettant en avant le libellé du type de mission ("Maintenance Management", "Audit
   * Complet"…) en tête du corps de mission — fond clair + texte orange gras, relevé dans le XML
   * complet de LVO-MM-26035_CHM.docx. */
  | { type: "typeLabel"; text: string }
  /** Paragraphe à mise en forme inline (gras/italique par run) — issu de l'éditeur riche
   * (Mission Spéciale), cf. offre-html-blocks.ts */
  | { type: "richParagraph"; runs: RichRun[] };

const heading = (text: string): ContentBlock => ({ type: "heading", text });
const subheading = (text: string): ContentBlock => ({ type: "subheading", text });
const paragraph = (text: string): ContentBlock => ({ type: "paragraph", text });
const bullet = (text: string): ContentBlock => ({ type: "bullet", text });
const subbullet = (text: string): ContentBlock => ({ type: "subbullet", text });
const boxed = (text: string): ContentBlock => ({ type: "boxed", text });
const typeLabel = (text: string): ContentBlock => ({ type: "typeLabel", text });

// ─── CGV — 15 articles (§7.C) ───────────────────────────────────────────────────

export const CGV_INTRODUCTION =
  "Les mentions « nous » et « le bureau d'études » renvoient à LVO-INGENIERIE, Société à " +
  "responsabilité limitée sous le numéro 102 486 917 R.C.S. Saint-Denis de La Réunion, dont le " +
  "siège social se trouve au Centre d'affaires CADJEE, 62 Boulevard du Chaudron, 97491 " +
  "Saint-Denis La Réunion.";

export const CGV_BLOCKS: ContentBlock[] = [
  heading("1. RESPONSABILITÉ CONCERNANT VOS TRAVAUX"),
  paragraph(
    "Nous vous confirmerons qui sera responsable de vos travaux. Le consultant agissant en " +
      "votre nom sera certainement secondé par d'autres consultants ou employés facturables du " +
      "cabinet. Si ces personnes sont amenées à jouer un rôle permanent, nous vous communiquerons " +
      "leurs coordonnées.",
  ),

  heading("2. LA MANIÈRE DONT NOUS EXÉCUTONS VOS INSTRUCTIONS"),
  paragraph(
    "Le cas échéant, nous conviendrons d'une stratégie concernant vos travaux et nous vous " +
      "tiendrons au courant de leur évolution, afin que vous puissiez prendre des décisions " +
      "éclairées le moment voulu. Si vous souhaitez opter pour une solution contraire à notre " +
      "conseil, nous vous demanderons de confirmer vos instructions par écrit. Nous nous " +
      "engageons à respecter toute échéance convenue, sauf accord écrit contraire stipulant une " +
      "heure, une date ou une période de livraison.",
  ),

  heading("3. CONCLUSION DU CONTRAT"),
  paragraph(
    "Nous vous informons que la signature de l'ordre de mission vaut pour acceptation des " +
      "présentes Conditions Générales. Tout ordre de mission surchargé ou raturé sera considéré " +
      "comme nul.",
  ),

  heading("4. PORTÉE DE NOTRE CONSEIL"),
  paragraph(
    "4.1 Notre expertise et notre conseil sont spécialisés et découlent de notre expérience " +
      "ainsi que des codes, normes, lois applicables dans le territoire concerné. Notre expertise " +
      "relève du domaine du « transport des personnes et des biens ».",
  ),
  paragraph(
    "4.2 Nous fournissons un conseil et préparons des documents en tenant compte des codes, " +
      "normes et lois en vigueur au moment de la livraison. Ces éléments sont uniquement censés " +
      "être utilisés en rapport avec le projet spécifique qui nous a été confié.",
  ),

  heading("5. HONORAIRES ET FRAIS"),
  paragraph(
    "Les honoraires sont calculés en grande partie en fonction du temps nécessaire pour " +
      "réaliser les travaux pendant les heures de bureau habituelles. D'autres facteurs peuvent " +
      "intervenir, tels que la nécessité d'agir rapidement, la complexité du projet, des " +
      "déplacements, et le volume de la documentation. Les tarifs horaires sont revalorisés " +
      "chaque année au 1er janvier. TVA : les honoraires et frais sont assujettis à la TVA au " +
      "taux en vigueur : {{TVA}} % (ou 2,1 % avec justificatif : immeuble construit depuis plus " +
      "de 2 ans, en majorité à usage copropriété).",
  ),

  heading("6. FACTURES"),
  paragraph(
    "Nos factures sont envoyées tous les mois, sauf accord contraire. Conformément à la loi " +
      "N°92-4442 du 31/12/1992, les notes d'honoraires sont payables comptant à réception. Toute " +
      "facture non réglée dans les 30 jours entraîne des intérêts de 2 % par mois de retard sur " +
      "le montant dû. Nous nous réservons le droit d'interrompre le travail jusqu'au règlement " +
      "intégral des factures impayées.",
  ),

  heading("7. CONFIDENTIALITÉ"),
  paragraph(
    "Nous considérerons comme confidentielles toutes les informations que vous nous confiez, " +
      "ainsi que toutes les informations en rapport avec les projets nous incombant. Nous ne " +
      "divulguerons pas les informations confidentielles à un tiers, sauf si vous y consentez " +
      "par écrit au préalable ou si cela est nécessaire dans le cadre de notre prestation de " +
      "services, ou dans la mesure où la loi l'exige.",
  ),

  heading("8. INSTRUCTIONS DU CLIENT"),
  paragraph(
    "Vous acceptez de veiller à ce que nous ayons connaissance de tous les éléments de votre " +
      "projet, de nous communiquer vos instructions en temps opportun et de manière précise, de " +
      "nous informer rapidement de tout changement de situation influant sur votre projet, et de " +
      "répondre rapidement à nos demandes d'instruction. Vous convenez que nous n'aurons qu'un " +
      "seul interlocuteur au sein de votre organisation qui jouera le rôle de point de contact " +
      "central.",
  ),

  heading("9. PROTECTION DES DONNÉES"),
  paragraph(
    "Nous traiterons les données personnelles que vous nous confiez aux fins suivantes : " +
      "(i) exécuter le travail conformément à vos instructions, (ii) fournir des instructions " +
      "aux personnes travaillant pour vous, (iii) respecter nos obligations légales et " +
      "professionnelles, et (iv) maintenir et utiliser nos bases de données de clients/contacts.",
  ),

  heading("10. FICHIERS, DOCUMENTS ET DONNÉES ÉLECTRONIQUES"),
  paragraph(
    "Nous pourrons conserver des fichiers et autres documents en rapport avec vos projets au " +
      "format électronique ou en version papier. Nous avons instauré des mesures de sécurité " +
      "visant à garantir le respect de nos obligations de confidentialité. Vous pouvez nous " +
      "demander de vous envoyer les fichiers et documents en rapport avec votre projet. Nous " +
      "nous réservons le droit de conserver des copies pour nos propres archives.",
  ),

  heading("11. PROPRIÉTÉ INTELLECTUELLE"),
  paragraph(
    "11.1 Nous conservons les droits d'auteur sur tout document ou outil de travail que nous " +
      "avons préparé pour vous, sauf accord spécifique contraire.",
  ),
  paragraph(
    "11.2 Nous vous accordons une licence non exclusive sans droits d'auteur, vous autorisant " +
      "à utiliser les documents uniquement dans le cadre du projet pour lequel ils ont été " +
      "élaborés ou produits.",
  ),

  heading("12. RESPONSABILITÉ"),
  paragraph(
    "12.1 Pendant la période où ce contrat est en vigueur, nous souscrirons une assurance " +
      "accidents du travail et une assurance de responsabilité civile.",
  ),
  paragraph(
    "12.2 La portée de notre travail ne comprendra pas de conseils sur les répercussions " +
      "commerciales d'un projet, sur des problèmes financiers ou comptables.",
  ),
  paragraph(
    "12.3 Notre conseil est spécifique à votre situation. Nous nous dégageons de toute " +
      "responsabilité vis-à-vis de toute personne à qui notre conseil ne s'adresse pas.",
  ),

  heading("13. PROCÉDURE DE PLAINTE"),
  paragraph(
    "13.1 Le bureau d'études s'engage à fournir un service de haute qualité. Tous les " +
      "litiges auxquels le marché pourra donner lieu seront, dans toute la mesure du possible, " +
      "résolus amiablement, et éventuellement par voie d'arbitrage. Les litiges sont portés " +
      "devant les tribunaux de Saint-Denis La Réunion. Le droit applicable est le droit " +
      "français.",
  ),
  paragraph(
    "13.2 En cas de demande ou de plainte concernant notre service, veuillez contacter sans " +
      "délai le consultant responsable mentionné dans le contrat.",
  ),

  heading("14. RÉSILIATION"),
  paragraph(
    "14.1 Vous pouvez résilier vos instructions à n'importe quel moment en nous en informant " +
      "par écrit. Nous ne cesserons de travailler pour vous que si vous n'avez pas réglé une " +
      "facture après un mois, si vous ne satisfaites pas à notre demande de régler nos " +
      "honoraires, ou si nous ne pouvons pas obtenir d'instructions claires de votre part.",
  ),
  paragraph(
    "14.2 La résiliation n'altèrera pas notre droit à obtenir le règlement du travail " +
      "effectué jusqu'à la date de résiliation.",
  ),

  heading("15. GÉNÉRALITÉS"),
  paragraph(
    "15.1 Les présentes conditions générales, de même que nos services, sont régis par le " +
      "droit français et vous comme nous sommes irrévocablement assujettis à la compétence des " +
      "tribunaux français.",
  ),
  paragraph(
    "15.2 La mention « vous » ou notre « client » renvoie à nos clients, tels qu'identifiés " +
      "dans la lettre que nous vous avons adressée ou dans toute autre communication écrite.",
  ),
  paragraph(
    "15.3 Si l'une des dispositions des présentes conditions est considérée nulle ou " +
      "inapplicable, l'intégralité des autres dispositions restera en vigueur et de plein " +
      "effet.",
  ),
];

// ─── Corps de mission (§7.B) — Audit / MOE / MS uniquement ─────────────────────
// (APS/DCE du POC Spring Boot n'ont pas d'équivalent parmi les codes mission réels
// de ce CRM (A, ADC, MOE, ET, MCM, MCN, MM, MS) — non portés, cf. plan.)

const AUDIT_COLLECTE_ANALYSE: ContentBlock[] = [
  heading("1. Collecte et Analyse des Données"),
  subheading("a. Inventaire des équipements"),
  paragraph(
    "Réalisation d'un inventaire détaillé de l'ensemble des équipements de transport vertical " +
      "inclus dans la mission. Cet inventaire comprendra notamment :",
  ),
  bullet("La localisation de chaque appareil au sein du site ;"),
  bullet("Les caractéristiques techniques principales ;"),
  bullet("L'état général des installations ;"),
  bullet("La pertinence des solutions de maintenance et de réparation actuellement mises en œuvre ;"),
  bullet("Le niveau de conformité aux réglementations européennes et françaises en vigueur ;"),
  bullet("La conformité aux exigences relatives à la sécurité et à la protection de la santé ;"),
  bullet("L'appréciation de la fiabilité et de l'aspect général des équipements."),

  subheading("b. Évaluation technique des équipements"),
  paragraph(
    "Inspection approfondie de chaque appareil, accompagnée d'une analyse qualitative portant, " +
      "selon la configuration des installations, sur les éléments suivants :",
  ),
  bullet("Qualité de fonctionnement, bruit et vibrations ;"),
  bullet("Précision d'arrêt aux niveaux ;"),
  bullet("Systèmes de détection des passagers ;"),
  bullet("Fonctionnement des portes cabine et palières ;"),
  bullet("Dispositifs d'alarme et système de téléalarme ;"),
  bullet("État des finitions intérieures de la cabine ;"),
  bullet("Fonctionnement des organes de commande ;"),
  bullet("Éclairage de la cabine, de la machinerie et de la gaine ;"),
  bullet("Propreté générale de l'installation ;"),
  bullet("Signalisation réglementaire et notices d'utilisation ;"),
  bullet("État du tableau de commande et de l'armoire de contrôle ;"),
  bullet("État du système d'entraînement, de la pompe ou de la soupape hydraulique ;"),
  bullet("État des poulies, câbles et organes mécaniques ;"),
  bullet("Dispositifs de rappel et de secours ;"),
  bullet("Mécanismes de déverrouillage d'urgence ;"),
  bullet("État du toit de cabine ;"),
  bullet("État de la fosse et de la gaine ;"),
  bullet("État des équipements de sécurité et de l'ossature de la gaine."),

  subheading("c. Évaluation de la maintenance"),
  paragraph("Analyse de la qualité de la maintenance actuellement réalisée, incluant :"),
  bullet("Les opérations de nettoyage, lubrification et réglage ;"),
  bullet("Le remplacement ou la réparation des composants défectueux ;"),
  bullet("La fréquence et la pertinence des visites d'entretien ;"),
  bullet("L'évaluation globale de la performance du prestataire de maintenance ;"),
  bullet("Les constats techniques ;"),
  bullet("Les observations relatives à la maintenance ;"),
  bullet("La liste des actions correctives ou réglages à réaliser par l'entreprise de maintenance."),

  subheading("d. Vérification de la conformité réglementaire"),
  paragraph("Analyse du niveau de conformité des installations :"),
  bullet("Aux normes européennes applicables ;"),
  bullet("À la réglementation française en vigueur ;"),
  bullet("Aux exigences relatives à la sécurité des usagers et du personnel."),
  paragraph(
    "Cette analyse sera complétée par des recommandations de mise en conformité et " +
      "d'amélioration lorsque cela sera jugé nécessaire.",
  ),
];

const AUDIT_DELAIS: ContentBlock = boxed(
  "Le rapport final sera transmis au client dans un délai de trois (3) semaines à compter de la " +
    "date de réalisation de la visite sur site et de la collecte des données.",
);

/** Corps de mission commun à Audit et CTQ (Contrôle Technique Quinquennal) — CTQ réutilise
 * exactement le même contenu, seul le libellé du type ("Audit Complet" → "CTQ Complet") et le
 * titre du rapport ("Rapport d'Audit" → "Rapport CTQ") changent, sur demande explicite. */
function buildAuditLikeBlocks(missionTitle: string, reportTitle: string): ContentBlock[] {
  return [
    typeLabel(missionTitle),
    heading("Contenu de la Mission"),
    ...AUDIT_COLLECTE_ANALYSE,
    heading(reportTitle),
    paragraph(
      "À l'issue de la mission, LVO-INGENIERIE remettra un rapport écrit détaillé présentant les " +
        "résultats de l'étude et les conclusions de la mission.",
    ),
    paragraph("Le rapport comprendra notamment :"),
    subbullet("a. Description des équipements ;"),
    subbullet("b. Analyse de l'existant et des améliorations envisageables ;"),
    subbullet("c. Évaluation de la maintenance réalisée ;"),
    subbullet("d. Analyse de conformité réglementaire ;"),
    subbullet(
      "e. Recommandations de modernisation, incluant les options techniques, les délais de " +
        "réalisation et les estimations budgétaires.",
    ),
    heading("DÉLAIS DE REMISE DU RAPPORT"),
    AUDIT_DELAIS,
  ];
}

const AUDIT_BLOCKS: ContentBlock[] = buildAuditLikeBlocks("Audit Complet", "2. Rapport d'Audit");
const CTQ_BLOCKS: ContentBlock[] = buildAuditLikeBlocks("CTQ Complet", "2. Rapport CTQ");

// ─── Maîtrise d'Œuvre — texte verbatim porté depuis LVO-MOE-26026_Stade en eau vive.docx
// (trame de référence) ────────────────────────────────────────────────────────────────

const MOE_PHASE3_DET: ContentBlock[] = [
  paragraph(
    "La direction de l'exécution des travaux porte sur le contrôle du respect entre les " +
      "documents d'exécution et les prescriptions du marché, dans ses aspects qualitatifs, " +
      "financiers et des délais.",
  ),
  bullet("1. Organisation et direction des réunions de chantier,"),
  bullet(
    "2. Établissement et diffusion des comptes rendus, information du maître d'ouvrage sur " +
      "l'état d'avancement général des travaux à partir du planning général,",
  ),
  bullet("3. Refus des matériaux non-conformes ou défectueux et s'assurer de leur remplacement,"),
  bullet("4. Contrôle de façon permanente l'avancement de travaux par rapport au calendrier,"),
  bullet(
    "5. Synthèse des choix des matériaux, échantillons ou coloris à valider par le maître " +
      "d'ouvrage.",
  ),
  subheading("Gestion financière et administrative"),
  bullet(
    "1. Notification de recommandation au maître d'ouvrage sur les réserves éventuellement " +
      "formulées par l'entreprise retenue en cours d'exécution des travaux et sur le décompte " +
      "général,",
  ),
  bullet("2. Assister le maître d'ouvrage en cas de litige sur l'exécution ou le règlement des travaux,"),
  bullet("3. Vérifier les factures d'acomptes travaux, décomptes mensuels et finaux,"),
  bullet(
    "4. Le maître d'œuvre procède, au cours des travaux, à la vérification des projets de " +
      "décomptes mensuels établis par l'entreprise retenue et qui lui sont transmis par lettre " +
      "recommandée avec avis de réception postal ou remis contre récépissé.",
  ),
  bullet(
    "5. Le projet de décompte mensuel est accepté ou rectifié par le maître d'œuvre qui l'envoie " +
      "ensuite au maître d'ouvrage. Le règlement des factures présentées par le maître d'œuvre " +
      "sont payable à 30 jours de leur date de réception après vérification de leur mention et " +
      "de l'exécution des prestations correspondantes.",
  ),
  bullet("6. Examen des devis de travaux complémentaires,"),
  paragraph(
    "La présente mission ne comprend pas les prestations nécessaires au remplacement d'une " +
      "entreprise défaillante (constat contradictoire, consultation des entreprises, choix " +
      "d'une autre entreprise).",
  ),
  subheading("Assistance aux opérations de réception"),
  bullet(
    "1. Planifier et organiser avant réception des visites techniques, le programme des essais " +
      "et les opérations préalables à la réception,",
  ),
  bullet(
    "2. Établir la liste des réserves et des remarques formulées lors de la réception des " +
      "travaux et leur suivi jusqu'à leur levée dans les délais définis,",
  ),
  bullet("3. Examiner et traiter avec l'entreprise les désordres signalés par le maître d'ouvrage,"),
  bullet("4. Vérifier le dossier des ouvrages exécutés (DOE),"),
  bullet("5. Valider les performances des installations."),
  bullet("6. Proposer au maître d'ouvrage la réception définitive."),
];

const MOE_PHASE1_AVANT_PROJET: ContentBlock[] = [
  heading("Phase 1 : Avant-Projet"),
  bullet("1. Relevé sur site des équipements et leurs environnement."),
  bullet(
    "2. Analyser les données du cahier de programmation du client et définir les données de " +
      "base du projet de transport vertical, avec le Maître d'Ouvrage et les autres membres de " +
      "l'équipe de conception.",
  ),
  bullet(
    "3. Fournir un rapport d'analyse établissant les critères principaux et nos suggestions " +
      "pour optimiser le trafic ascenseurs, les performances à atteindre. Ce rapport traitera " +
      "notamment des points suivants :",
  ),
  bullet(
    "4. Notes comparatives sur les différentes technologies pouvant être mises en œuvre sur le " +
      "projet avec les avantages et les inconvénients (techniques et financiers) de chaque " +
      "solution envisagée.",
  ),
  bullet("5. Les grandes lignes et le descriptif technique des équipements retenus."),
  bullet("6. Recommandations en terme de protection liée à l'environnement des équipements."),
  bullet("7. Mettre à jour les estimations budgétaires et de planifications."),
  bullet("8. Participer à une réunion de présentation de l'avant-projet."),
];

const MOE_PHASE2_DCE_AMT: ContentBlock[] = [
  heading("Phase 2 : Appel d'offres : DCE"),
  paragraph("Fournir un dossier de consultation complet qui comprendra :"),
  bullet(
    "1. Les spécifications complètes et détaillées en reprenant la construction du document " +
      "Avant-Projet.",
  ),
  bullet("2. Un bordereau de remise de prix (DPGF)."),
  bullet("3. Un planning et la procédure d'appel d'offres."),
  bullet("4. Les documents d'appel d'offres seront conçus pour encourager une saine compétition."),
  subheading("Négociation : AMT"),
  paragraph("Fournir une assistance sur tout point relatif à l'appel d'offre. Une telle assistance comprend :"),
  bullet("1. Consultations sur les procédures d'appel d'offres."),
  bullet(
    "2. Évaluation des soumissions, clarifications des réserves et ambiguïtés des soumissions, " +
      "présenter des recommandations.",
  ),
  bullet("3. Assister et mener les réunions d'examen des offres soumises."),
  bullet("4. Participer à la négociation si nécessaire."),
];

const MOE_PHASE4_GPA: ContentBlock[] = [
  paragraph("Le maître d'œuvre fournit une assistance pendant la période de parfait achèvement."),
];

const MOE_BLOCKS: ContentBlock[] = [
  ...MOE_PHASE1_AVANT_PROJET,
  ...MOE_PHASE2_DCE_AMT,
  heading("Phase 3 : Exécution & Travaux : DET"),
  ...MOE_PHASE3_DET,
  heading("Phase 4 : Garantie de parfait achèvement"),
  ...MOE_PHASE4_GPA,
];

/** Registre des 4 phases MOE sélectionnables indépendamment (offre de type MOE, Phase 10). */
export type MoePhaseCode = "AVANT_PROJET" | "DCE_AMT" | "DET" | "GPA";

export const MOE_PHASES: { code: MoePhaseCode; label: string; blocks: ContentBlock[] }[] = [
  { code: "AVANT_PROJET", label: "Avant-Projet", blocks: MOE_PHASE1_AVANT_PROJET },
  { code: "DCE_AMT", label: "Appel d'offres — DCE et AMT", blocks: MOE_PHASE2_DCE_AMT },
  {
    code: "DET",
    label: "Exécution & Travaux — DET",
    blocks: [heading("Phase 3 : Exécution & Travaux : DET"), ...MOE_PHASE3_DET],
  },
  {
    code: "GPA",
    label: "Garantie de parfait achèvement",
    blocks: [heading("Phase 4 : Garantie de parfait achèvement"), ...MOE_PHASE4_GPA],
  },
];

/** Corps de mission MOE limité aux phases sélectionnées par l'utilisateur, dans l'ordre fixe
 * Avant-Projet → DCE/AMT → DET → GPA. */
export function buildMoeMissionBody(selectedCodes: string[]): MissionBody {
  const blocks = MOE_PHASES.filter((p) => selectedCodes.includes(p.code)).flatMap((p) => p.blocks);
  return { type: "MOE", libelle: "Maîtrise d'Œuvre", blocks };
}

const MS_BLOCKS: ContentBlock[] = [
  heading("Phase 1 : Recommandations"),
  bullet("1. Analyse des documents de consultation et de ceux de l'entreprise retenue pour les travaux."),
  bullet(
    "2. Recommandations et suggestions pour optimiser le trafic ascenseurs, les performances à " +
      "atteindre, la fiabilisation de l'équipement…",
  ),
  bullet("3. Participer à une réunion de présentation des recommandations."),
  boxed(
    "Le rendu mail sera transmis au client dans un délai de deux (2) semaines à compter de la " +
      "date d'envoi des données client.",
  ),
  heading("Phase 2 : Assistance aux opérations de réception"),
  bullet("1. Assister le maître d'ouvrage lors d'une visite préalable à la réception."),
  bullet("2. Établir la liste des réserves et des remarques / recommandations formulées lors de la visite sur site."),
  boxed("Selon planning maître d'ouvrage."),
];

// ─── Maintenance Management — texte verbatim porté depuis LVOMM26035_CHM.docx (trame de
// référence la plus récente, reporting semestriel) ──────────────────────────────────────────

const MM_BLOCKS: ContentBlock[] = [
  typeLabel("Maintenance Management"),
  heading("OBJET DU CONTRAT"),
  paragraph(
    "LVO-INGENIERIE, par le présent document, accepte de fournir des services de conseil, " +
      "d'assistance et de suivi dans le cadre du contrat de Maintenance Management dont il est " +
      "fait mention plus haut, conformément aux informations ci-après stipulant l'étendue des " +
      "services et les conditions générales de vente (sauf accord écrit contraire) au prix " +
      "devisé ci-dessous, hors services supplémentaires et taxe sur la valeur ajoutée.",
  ),

  heading("CONTENU DE LA MISSION"),
  paragraph("Les rôles et responsabilités spécifiques de LVO-INGENIERIE pour cette prestation sont définis ci-dessous."),
  paragraph(
    "Un interlocuteur unique vous assistera dans le suivi administratif et technique de vos " +
      "installations. L'objectif de ce contrat de maintenance management doit permettre de " +
      "maintenir au niveau contractuel le fonctionnement et la disponibilité de vos ascenseurs " +
      "et d'améliorer le niveau de sécurité global de ces équipements.",
  ),
  paragraph("LVO-INGENIERIE fera le nécessaire pour maintenir ou améliorer la relation avec le ou les prestataires ascenseurs."),
  paragraph("Les missions suivantes seront réalisées dans le cadre de ce contrat :"),

  subheading("Suivi des contrôles techniques annuels"),
  paragraph("Une fois la visite de contrôle effectuée, LVO-INGENIERIE s'assurera que les rapports sont envoyés dans les meilleurs délais au prestataire pour traitement."),
  paragraph("Une copie de ces rapports sera transmise dans le même temps au consultant LVO-INGENIERIE. Ce dernier analysera ces rapports de contrôle et planifiera les essais et vérifications non faites."),
  paragraph("Après analyse, LVO-INGENIERIE assurera le suivi des actions à mettre en place par le prestataire pour lever les réserves formulées dans le rapport."),
  paragraph("LVO-INGENIERIE validera ou refusera les devis émis par le prestataire couvrant les risques et réserves identifiés."),

  subheading("Support technique"),
  paragraph("LVO-INGENIERIE assure une Assistance Téléphonique et conseil le gestionnaire en cas de pannes répétitives sur les installations couvertes par notre contrat."),
  paragraph("Le consultant prendra contact avec l'ascensoriste pour connaître les raisons détaillées de ces pannes et les actions mises en place."),

  subheading("Suivi administratif"),
  paragraph("LVO-INGENIERIE assure la vérification et la validation des factures de maintenance du prestataire, des devis de réparations et des devis pour intervention hors contrat qui lui sont transmises par le signataire de ce contrat."),
  paragraph("Après vérification, LVO-INGENIERIE transmet au client les factures pour paiement ou demande d'avoir/annulation auprès du prestataire de maintenance."),

  subheading("Reporting semestriel"),
  paragraph("Une analyse des rapports de maintenance et des interventions, un suivi des actions spécifiques réalisées, un bilan des levées de réserves du rapport de contrôles est effectué."),
  paragraph("Un tableau des pénalités contractuelles est dressé et discuté avec le prestataire de maintenance afin de déterminer si ces pénalités contractuelles seront appliquées."),
  paragraph("Le Planning des actions à réaliser est mis à jour pour la prochaine réunion et une planification de réunions intermédiaires est organisée si nécessaire."),

  subheading("Réunions"),
  bullet("Une réunion semestrielle en vidéoconférence avec l'entreprise et le client."),
  bullet("Une réunion annuelle en présentiel avec l'entreprise et le client."),

  heading("DÉLAIS – DURÉE DU CONTRAT"),
  // Contrairement à Audit/CTQ et MS, la trame MM (LVO-MM-26035_CHM.docx) ne met PAS ce délai
  // dans un encadré : c'est un simple paragraphe sous le titre.
  paragraph(
    "Dans le cadre de cette prestation, LVO-INGENIERIE fournira le soutien opérationnel, " +
      "technique et le suivi de la gestion des équipements de transport vertical situés sur les " +
      "sites nommés en annexe pour une période de 1 an à partir de la date de signature du " +
      "contrat, sauf indication du contraire par écrit. À la fin de cette période, le contrat " +
      "sera renouvelé par tacite reconduction pour une période de 1 an (un an).",
  ),
];

export type MissionBody = { type: string; libelle: string; blocks: ContentBlock[] };

/** Types de mission avec un corps rédigé figé — les autres (ADC, ET, MCN, MCM) n'en ont pas et
 * s'appuient uniquement sur le tableau de phases réel de l'offre (cf. plan, décision 1). */
const MISSION_BODIES: Record<string, MissionBody> = {
  A: { type: "A", libelle: "Audit Complet", blocks: AUDIT_BLOCKS },
  CTQ: { type: "CTQ", libelle: "CTQ Complet", blocks: CTQ_BLOCKS },
  MOE: { type: "MOE", libelle: "Maîtrise d'Œuvre", blocks: MOE_BLOCKS },
  MM: { type: "MM", libelle: "Maintenance Management", blocks: MM_BLOCKS },
  MS: { type: "MS", libelle: "Recommandations + AOR", blocks: MS_BLOCKS },
};

export function getMissionBody(typeMission: string): MissionBody | null {
  return MISSION_BODIES[typeMission.toUpperCase()] ?? null;
}

/** Nombre de phases numérotées ("Phase 1 : …", "Phase 2 : …") décrites dans le corps de
 * mission figé — sert de repère pour signaler un tableau d'honoraires dont le nombre de
 * lignes ne correspond pas au nombre de phases annoncées (types sans corps figé, ex. MCN/MCM,
 * ou sans découpage en "Phase N" comme Audit, renvoient 0 : pas de contrôle applicable). */
export function expectedPhaseCount(body: MissionBody | null): number {
  if (!body) return 0;
  return body.blocks.filter((b) => b.type === "heading" && /^Phase\s+\d+/i.test(b.text)).length;
}

export const MISSION_LABELS: Record<string, string> = {
  A: "Audit",
  CTQ: "Contrôle Technique Quinquennal",
  ADC: "Audit et Avant-Projet",
  MOE: "Maîtrise d'Œuvre",
  ET: "Études Techniques",
  MCM: "Maintenance",
  MCN: "Modernisation",
  MM: "Maintenance Management",
  MS: "Mission de Service",
};

// ─── Courrier type (§7.A) ───────────────────────────────────────────────────────

export const COURRIER_INTRO_PARAGRAPHS: string[] = [
  "Nous avons le plaisir de vous communiquer, ci-joint, notre meilleure proposition " +
    "d'honoraires pour vous conseiller et vous assister en tant que BET Transports mécaniques dans " +
    "le cadre de ce projet.",
  "LVO-INGENIERIE offre à ses clients une expertise de conseil spécialisée dans le " +
    "domaine du transport vertical des biens et des personnes. Nos consultants expérimentés sont " +
    "spécialisés dans les disciplines suivantes :",
];

export const COURRIER_DISCIPLINES: string[] = [
  "Transport vertical",
  "Transport horizontal",
  "Analyses de trafic",
  "Gestion de projets Neufs et Modernisations",
  "Maintenance Management",
];

export const COURRIER_OUTRO_PARAGRAPHS: string[] = [
  "L'ensemble des services proposés faisant partie de notre offre sont précisés dans le " +
    "« Descriptif des services de consultation ». Notre document de synthèse intitulé " +
    "« Informations aux Clients et Conditions Générales de Ventes » est également joint.",
  "Nous espérons avoir correctement interprété vos instructions et nous nous réjouissons " +
    "de cette opportunité de mettre notre expertise à votre service.",
  "Afin de formaliser notre accord, nous vous demanderons de bien vouloir nous retourner " +
    "un exemplaire de notre ordre de mission signé.",
  "N'hésitez pas à nous contacter pour toute information que vous jugerez nécessaire.",
  "Veuillez agréer, Monsieur, l'expression de nos respectueuses salutations.",
];

export const LVO_SIGNATAIRE = "Hatem LEMBARKI";
export const LVO_SIGNATAIRE_FONCTION = "Fondateur Gérant";
export const LVO_ADRESSE_SIEGE = "Centre d'affaires CADJEE — 62 Bd du Chaudron | 97491 Saint-Denis La Réunion";
export const LVO_CONTACT_FOOTER = "Tél : 06 92 05 39 52 | hatem.lembarki@lvo-ing.com";
