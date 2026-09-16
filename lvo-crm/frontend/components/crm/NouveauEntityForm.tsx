"use client";

import Link from "next/link";
import { FormEvent, useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch } from "@/lib/api";
import {
  onAgenceScopeChange,
  readAgenceScope,
  rowMatchesAgenceScope,
  scopeDef,
  type AgenceScopeId,
} from "@/lib/agence-scope";
import { notifyCountsRefresh } from "@/lib/dashboard-counts";
import { LVO_MISSION_TYPES, primaryMissionFromSelection, referenceHints } from "@/lib/reference-lvo";
import { CRM_OFFRE_STATUTS } from "@/lib/crm-workflow";
import { readToken } from "@/lib/token-storage";
import { calcShapeOf, emptyMissionCalc, missionCalcShapeFor, validateMissionCalc } from "@/lib/mission-calc";
import type { ClientRow, CommandeRow, ContactRow, EquipementQteLigne, MissionCalc, SiteRow, TypeEquipementRow } from "@/lib/types";

import { ContactFormFields } from "@/components/crm/forms/ContactFormFields";
import { NewClientModal } from "@/components/crm/forms/NewClientModal";
import { EquipementsQuantiteFields } from "@/components/crm/forms/EquipementsQuantiteFields";
import { MissionCalcFields } from "@/components/crm/forms/MissionCalcFields";
import { CrmPageHeader } from "@/components/crm/ui";

/** Types de mission outillés par le calcul auto (Audit/MM/MOE/MS) — cf. lib/mission-calc.ts.
 * Les 4 autres types legacy (ADC/ET/MCM/MCN) gardent la saisie JSON brute existante. */
const MISSION_CALC_TYPES = new Set(["A", "CTQ", "MM", "MOE", "MS"]);

export type Slug = "contact" | "client" | "site" | "offre" | "commande" | "facture" | "phases";

type EntityMeta = {
  title: string;
  subtitle: string;
  listHref?: string;
  listLabel?: string;
};

type Props = {
  slug: Slug;
  meta: EntityMeta;
};

type FormShape = Record<string, string>;

const SUGGESTED_CLIENTS_GROUPEMENT = ["SIDR", "SODIAC", "SEMADER"];
const SITE_CLIENT_AUTRE = "__AUTRE__";
const SITE_TYPE_AUTRE = "__AUTRE__";
const SITE_TYPE_OPTIONS = [
  "Résidence",
  "Résidentiel",
  "Tertiaire",
  "Bureaux",
  "Santé",
  "Commercial",
  "Gare",
  "Aéroport",
  "Hôtel",
  "Gymnase",
  "Établissement scolaire",
  "Administratif",
  "Parking",
];
const OFFRE_GEST_CONTACT_AUTRE = "__AUTRE__";

type PhaseRef = { typeMission: string; code: string; libelle: string; prixIndicatifHt: number; ordre: number };

const BASE_FORM: Record<Slug, FormShape> = {
  contact: { civilite: "M.", prenom: "", nom: "", entreprise: "", fonction: "", email: "", telephone: "", mobile: "" },
  client: { raisonSociale: "", entite: "", email: "", telephone: "", siret: "", codePostal: "", responsableEmail: "" },
  site: { nom: "", typeSite: "", adresse: "", clientNom: "" },
  offre: {
    numeroOffre: "",
    typeMission: "MS",
    statut: "ENVOYEE",
    montantHt: "",
    dateOffre: new Date().toISOString().slice(0, 10),
    clientNom: "",
    siteNom: "",
    phasesMode: "ALL",
    consultantEmail: "",
    gestionnaireNom: "",
    gestionnaireContact: "",
    tauxTva: "8.5",
    missions:
      '[{"code":"MS-REG","libelle":"Mission réglementaire / obligations code du travail","montantHt":3200},{"code":"MS-VP","libelle":"Visites périodiques & registre","montantHt":2100}]',
    echeancierFacturation:
      '[{"libelle":"Acompte à commande","pourcentage":30,"moisFacturation":"2026-06"},{"libelle":"Solde","pourcentage":70,"moisFacturation":"2026-08"}]',
    echeancierExecution:
      '[{"libelle":"Lancement mission","datePrevue":"","ecartSemaines":0},{"libelle":"Livraison / clôture","datePrevue":"","ecartSemaines":8}]',
    customPhases: "",
  },
  commande: {
    numeroCommande: "",
    dateCommande: "",
    typeMission: "MS",
    statut: "EN_COURS",
    montantHt: "",
    montantFacture: "",
    clientNom: "",
    siteNom: "",
    numeroClient: "",
  },
  facture: {
    numeroFacture: "",
    numeroCommande: "",
    dateFacture: "",
    clientNom: "",
    montantHt: "",
    frais: "",
    modeReglement: "VIREMENT",
    commandeId: "",
  },
  phases: { conception: "40", execution: "60", note: "" },
};

const DOM_TOM_NOMS = ["REUNION", "GUADELOUPE", "MARTINIQUE", "GUYANE", "MAYOTTE"];

function clientIsDomTom(c: ClientRow): boolean {
  const e = String(c.entite || "").trim();
  if (/^(97|98)/.test(e.replace(/\s/g, ""))) return true;
  if (["974", "971", "972", "973", "976", "978"].includes(e)) return true;
  const eNorm = e.toUpperCase().normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "");
  if (DOM_TOM_NOMS.some((nom) => eNorm.includes(nom))) return true;
  const cp = String(c.codePostal || "").replace(/\s/g, "");
  return /^(97|98)\d{3}/.test(cp);
}

function parseEcheJson(raw: string): unknown {
  const t = raw.trim();
  if (!t) return [];
  try {
    return JSON.parse(t) as unknown;
  } catch {
    return [];
  }
}

function isValidEmail(v: string) {
  if (!v.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function isPositiveNumber(v: string) {
  if (!v.trim()) return false;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0;
}

/** Génère le prochain n° LVO séquentiel, format LVO-{TYPE}-{YYYY}-{nnn} (ex. LVO-MOE-2026-001). */
export function NouveauEntityForm({ slug, meta }: Props) {
  const fid = useId();
  const router = useRouter();
  const [form, setForm] = useState<FormShape>(BASE_FORM[slug]);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [commandes, setCommandes] = useState<CommandeRow[]>([]);
  const [offreParties, setOffreParties] = useState<{
    defaultClientNom: string;
    defaultGestionnaireNom: string;
    defaultGestionnaireContact: string | null;
    defaultGestionnaireContactId: number | null;
    options: {
      clientNom: string;
      label: string;
      role: string;
      responsableContact: string | null;
      contactId: number | null;
      contactNom: string | null;
    }[];
  } | null>(null);
  const [offreContacts, setOffreContacts] = useState<ContactRow[]>([]);
  const [offreGestContactAutre, setOffreGestContactAutre] = useState(false);
  const [crmSettings, setCrmSettings] = useState<{
    defaultConsultantEmail: string;
    tvaMetropolePercent: number;
    tvaDomPercent: number;
  } | null>(null);
  const [consultants, setConsultants] = useState<{ id: number; email: string; role: string }[]>([]);
  const [refPhases, setRefPhases] = useState<PhaseRef[]>([]);
  const [phasePick, setPhasePick] = useState<Record<string, boolean>>({});
  const [commandeMissionPick, setCommandeMissionPick] = useState<Record<string, boolean>>({});
  const [offreMissionPick, setOffreMissionPick] = useState<Record<string, boolean>>({});
  const [offreMissionCalc, setOffreMissionCalc] = useState<MissionCalc | null>(null);
  const [agenceScope, setAgenceScope] = useState<AgenceScopeId>("ALL");

  // Commande — import bon de commande (extraction PDF) et échéancier de paiement
  const [bcFile, setBcFile] = useState<File | null>(null);
  const [bcExtracting, setBcExtracting] = useState(false);
  const [bcExtractError, setBcExtractError] = useState<string | null>(null);
  const [bcExtraction, setBcExtraction] = useState<{
    numero: string | null;
    adresse: string | null;
    fournisseur: string | null;
    client: string | null;
    montantTtc: number | null;
    referenceDevis: string | null;
  } | null>(null);
  const [paiementMode, setPaiementMode] = useState<"UNIQUE" | "ECHELONNE">("UNIQUE");
  const [echeances, setEcheances] = useState<{ montant: string; date: string }[]>([{ montant: "", date: "" }]);
  const [bcPreviewUrl, setBcPreviewUrl] = useState<string | null>(null);
  const [showBcPreview, setShowBcPreview] = useState(false);
  // Client/Site/Paiement restent masqués tant que l'extraction n'a pas tourné (ou échoué) au
  // moins une fois — l'extraction est censée les remplir automatiquement pour une commande.
  const [showManualFields, setShowManualFields] = useState(false);

  // Commande créée depuis le bouton « Créer une commande » d'une offre (CrmTablePage) :
  // récupère le contexte de l'offre via les paramètres d'URL pour pré-remplir le formulaire.
  const [offreOrigine, setOffreOrigine] = useState<{ offreId: number; numeroOffre: string } | null>(null);

  // Aperçu du bon de commande déposé — utile si l'extraction automatique échoue
  // (PDF scanné/image sans calque texte) : l'admin peut consulter le document
  // et saisir les champs manuellement à la place.
  useEffect(() => {
    if (!bcFile) {
      setBcPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(bcFile);
    setBcPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [bcFile]);

  useEffect(() => {
    setAgenceScope(readAgenceScope());
    return onAgenceScopeChange(() => setAgenceScope(readAgenceScope()));
  }, []);

  const clientsForSite = useMemo(() => {
    if (slug !== "site" || agenceScope === "ALL") return clients;
    return clients.filter((c) => rowMatchesAgenceScope(c as unknown as Record<string, unknown>, agenceScope));
  }, [clients, slug, agenceScope]);

  const [siteClientAutre, setSiteClientAutre] = useState(false);
  const [siteTypeAutre, setSiteTypeAutre] = useState(false);

  const siteClientOptions = useMemo(() => {
    const names = new Set<string>(SUGGESTED_CLIENTS_GROUPEMENT);
    for (const c of clientsForSite) names.add(c.raisonSociale);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [clientsForSite]);

  const [siteNewClientOpen, setSiteNewClientOpen] = useState(false);
  const [siteNewClientPrefill, setSiteNewClientPrefill] = useState("");
  const [siteContacts, setSiteContacts] = useState<ContactRow[]>([]);
  const [gestionnaireClientNom, setGestionnaireClientNom] = useState("");
  const [gestionnaireContactId, setGestionnaireContactId] = useState("");
  const [typesEquipement, setTypesEquipement] = useState<TypeEquipementRow[]>([]);
  const [equipementLignes, setEquipementLignes] = useState<EquipementQteLigne[]>([]);

  const gestionnaireContactOptions = useMemo(
    () =>
      siteContacts.filter(
        (c) => c.entreprise === gestionnaireClientNom && /gestionnaire/i.test(c.fonction || ""),
      ),
    [siteContacts, gestionnaireClientNom],
  );

  const offreGestContactOptions = useMemo(
    () =>
      offreContacts.filter(
        (c) => c.entreprise === form.gestionnaireNom && /gestionnaire/i.test(c.fonction || ""),
      ),
    [offreContacts, form.gestionnaireNom],
  );

  useEffect(() => {
    if (!["contact", "site", "offre", "commande", "facture"].includes(slug)) return;
    const token = readToken();
    let cancel = false;
    void (async () => {
      try {
        const calls: Promise<unknown>[] = [];
        calls.push(apiFetch("/api/clients", { token }));
        if (slug === "offre" || slug === "commande") calls.push(apiFetch("/api/sites", { token }));
        if (slug === "facture" || slug === "commande") calls.push(apiFetch("/api/commandes", { token }));
        if (slug === "site") calls.push(apiFetch("/api/contacts", { token }));
        if (slug === "site") calls.push(apiFetch("/api/types-equipement", { token }));
        if (slug === "offre") calls.push(apiFetch("/api/contacts", { token }));
        const data = await Promise.all(calls);
        if (cancel) return;
        setClients(Array.isArray(data[0]) ? (data[0] as ClientRow[]) : []);
        if (slug === "offre" || slug === "commande") setSites(Array.isArray(data[1]) ? (data[1] as SiteRow[]) : []);
        if (slug === "facture") setCommandes(Array.isArray(data[1]) ? (data[1] as CommandeRow[]) : []);
        if (slug === "commande") setCommandes(Array.isArray(data[2]) ? (data[2] as CommandeRow[]) : []);
        if (slug === "site") setSiteContacts(Array.isArray(data[1]) ? (data[1] as ContactRow[]) : []);
        if (slug === "site") setTypesEquipement(Array.isArray(data[2]) ? (data[2] as TypeEquipementRow[]) : []);
        if (slug === "offre") setOffreContacts(Array.isArray(data[2]) ? (data[2] as ContactRow[]) : []);
      } catch {
        if (!cancel) setErr("Impossible de charger les référentiels (clients/sites/commandes).");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [slug]);

  // Pré-remplissage depuis le bouton « Créer une commande » d'une offre (CrmTablePage) :
  // ?offreId=…&numeroOffre=…&clientNom=…&siteNom=…&montantHt=…&typeMission=…
  useEffect(() => {
    if (slug !== "commande") return;
    const qs = new URLSearchParams(window.location.search);
    const offreId = qs.get("offreId");
    if (!offreId) return;
    const numeroOffre = qs.get("numeroOffre") || "";
    const clientNom = qs.get("clientNom") || "";
    const siteNom = qs.get("siteNom") || "";
    const montantHt = qs.get("montantHt") || "";
    const typeMission = qs.get("typeMission") || "";
    if (clientNom) setField("clientNom", clientNom);
    if (siteNom) setField("siteNom", siteNom);
    if (typeMission) setCommandeMissionPick((prev) => ({ ...prev, [typeMission]: true }));
    if (montantHt && Number(montantHt) > 0) {
      setEcheances([{ montant: montantHt, date: "" }]);
    }
    setOffreOrigine({ offreId: Number(offreId), numeroOffre });
    // Le client/site sont déjà connus via l'offre : pas besoin d'attendre l'extraction du bon
    // de commande pour les afficher — l'admin n'a plus qu'à vérifier/compléter.
    setShowManualFields(true);
  }, [slug]);

  useEffect(() => {
    if (slug !== "offre") {
      setOffreParties(null);
      return;
    }
    const nom = form.siteNom?.trim();
    if (!nom) {
      setOffreParties(null);
      return;
    }
    const site = sites.find((s) => s.nom === nom);
    if (site == null) return;
    const token = readToken();
    let cancel = false;
    void (async () => {
      try {
        const d = (await apiFetch(`/api/sites/${site.id}/offre-destinataires`, { token })) as {
          defaultClientNom: string;
          defaultGestionnaireNom: string;
          defaultGestionnaireContact: string | null;
          defaultGestionnaireContactId: number | null;
          options: {
            clientNom: string;
            label: string;
            role: string;
            responsableContact: string | null;
            contactId: number | null;
            contactNom: string | null;
          }[];
        } | null;
        if (cancel) return;
        if (d && Array.isArray(d.options)) {
          setOffreParties(d);
          setForm((prev) => {
            const okClient = d.options.some((o) => o.clientNom === prev.clientNom);
            const okGest = d.options.some((o) => o.clientNom === prev.gestionnaireNom);
            return {
              ...prev,
              clientNom: okClient ? prev.clientNom : d.defaultClientNom,
              gestionnaireNom: okGest ? prev.gestionnaireNom : d.defaultGestionnaireNom,
              gestionnaireContact: okGest
                ? prev.gestionnaireContact
                : d.defaultGestionnaireContact ?? "",
            };
          });
          setOffreGestContactAutre(!d.defaultGestionnaireContactId);
        } else setOffreParties(null);
      } catch {
        if (!cancel) setOffreParties(null);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [slug, form.siteNom, sites]);

  useEffect(() => {
    if (slug !== "offre") return;
    const token = readToken();
    let cancel = false;
    void (async () => {
      try {
        const [st, cons] = await Promise.all([
          apiFetch("/api/settings", { token }) as Promise<{
            defaultConsultantEmail: string;
            tvaMetropolePercent: number;
            tvaDomPercent: number;
          } | null>,
          apiFetch("/api/users/consultants", { token }) as Promise<{ id: number; email: string; role: string }[] | null>,
        ]);
        if (cancel) return;
        if (st) setCrmSettings(st);
        if (Array.isArray(cons)) setConsultants(cons);
        setForm((prev) => ({
          ...prev,
          consultantEmail: prev.consultantEmail?.trim() ? prev.consultantEmail : st?.defaultConsultantEmail ?? "",
          tauxTva:
            prev.tauxTva && prev.tauxTva !== "8.5"
              ? prev.tauxTva
              : String(st?.tvaDomPercent ?? 8.5),
        }));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancel = true;
    };
  }, [slug]);

  useEffect(() => {
    if (slug !== "offre") return;
    const selected = LVO_MISSION_TYPES.filter((t) => offreMissionPick[t]);
    if (!selected.length) {
      setRefPhases([]);
      setPhasePick({});
      return;
    }
    const token = readToken();
    let cancel = false;
    void (async () => {
      try {
        const seen = new Set<string>();
        const merged: PhaseRef[] = [];
        for (const tm of selected) {
          const rows = (await apiFetch(`/api/phases-referentiel?typeMission=${encodeURIComponent(tm)}`, {
            token,
          })) as PhaseRef[] | null;
          const list = Array.isArray(rows) ? rows : [];
          for (const r of list) {
            if (!seen.has(r.code)) {
              seen.add(r.code);
              merged.push(r);
            }
          }
        }
        merged.sort((a, b) => a.ordre - b.ordre || a.code.localeCompare(b.code));
        if (cancel) return;
        setRefPhases(merged);
        setPhasePick({});
      } catch {
        if (!cancel) {
          setRefPhases([]);
          setPhasePick({});
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, [slug, offreMissionPick]);

  useEffect(() => {
    if (slug !== "offre" || !crmSettings) return;
    const c = clients.find((x) => x.raisonSociale === form.clientNom);
    if (!c) return;
    const dom = clientIsDomTom(c);
    const t = dom ? crmSettings.tvaDomPercent : crmSettings.tvaMetropolePercent;
    setForm((prev) => (prev.tauxTva === String(t) ? prev : { ...prev, tauxTva: String(t) }));
  }, [slug, form.clientNom, clients, crmSettings]);

  useEffect(() => {
    if (slug !== "facture") return;
    const cmd = commandes.find((c) => c.numeroCommande === form.numeroCommande);
    if (!cmd) return;
    setForm((prev) =>
      prev.commandeId === String(cmd.id) && prev.clientNom === cmd.clientNom
        ? prev
        : { ...prev, clientNom: cmd.clientNom, commandeId: String(cmd.id) },
    );
  }, [slug, form.numeroCommande, commandes]);

  useEffect(() => {
    if (slug !== "commande") return;
    const pick: Record<string, boolean> = {};
    for (const t of LVO_MISSION_TYPES) pick[t] = false;
    const tm = (LVO_MISSION_TYPES as readonly string[]).includes(form.typeMission) ? form.typeMission : "MS";
    pick[tm] = true;
    setCommandeMissionPick(pick);
  }, [slug]);

  const offreMissionsSelected = useMemo(
    () => LVO_MISSION_TYPES.filter((t) => offreMissionPick[t]),
    [offreMissionPick],
  );
  const offrePrimaryMission = useMemo(
    () => (offreMissionsSelected.length ? primaryMissionFromSelection(offreMissionsSelected) : "MS"),
    [offreMissionsSelected],
  );

  // Nombre d'ascenseurs actifs du site sélectionné — pré-remplit le calcul Audit/MM (Phase 10).
  const offreNbAscenseursSuggestion = useMemo(() => {
    const site = sites.find((s) => s.nom === form.siteNom);
    return site?.equipementsCount ?? null;
  }, [sites, form.siteNom]);

  // Valeur de calcul honoraires réellement utilisable pour le type de mission COURANT (Audit/MM/
  // MOE/MS). `offreMissionCalc` (state) peut rester, le temps d'un rendu, à la forme de l'ancien
  // type juste après un changement de sélection — recalculer ici plutôt que via un effet évite le
  // rendu intermédiaire avec une forme d'objet incohérente (ex. lire `.phases` sur un objet MS).
  const offreMissionCalcEffective = useMemo(() => {
    if (slug !== "offre" || !offreMissionsSelected.length || !MISSION_CALC_TYPES.has(offrePrimaryMission)) return null;
    if (offreMissionCalc && calcShapeOf(offreMissionCalc) === missionCalcShapeFor(offrePrimaryMission)) return offreMissionCalc;
    return emptyMissionCalc(offrePrimaryMission, offreNbAscenseursSuggestion);
  }, [slug, offreMissionsSelected, offrePrimaryMission, offreMissionCalc, offreNbAscenseursSuggestion]);

  useEffect(() => {
    if (slug !== "offre" || form.phasesMode !== "SELECTION" || MISSION_CALC_TYPES.has(offrePrimaryMission)) return;
    const sum = refPhases.filter((r) => phasePick[r.code]).reduce((s, r) => s + r.prixIndicatifHt, 0);
    setForm((f) => (f.montantHt === String(sum) ? f : { ...f, montantHt: String(sum) }));
  }, [slug, form.phasesMode, phasePick, refPhases, offrePrimaryMission]);

  useEffect(() => {
    if (slug !== "offre" || form.phasesMode !== "ALL" || !refPhases.length || MISSION_CALC_TYPES.has(offrePrimaryMission)) return;
    const pick: Record<string, boolean> = {};
    let sum = 0;
    for (const p of refPhases) {
      pick[p.code] = true;
      sum += p.prixIndicatifHt;
    }
    setPhasePick(pick);
    setForm((prev) => ({ ...prev, montantHt: String(sum) }));
  }, [slug, form.phasesMode, refPhases, offrePrimaryMission]);

  const filteredSites = useMemo(() => {
    // Offre : le client affiché ici est le destinataire (propriétaire OU gestionnaire du
    // site — Phase 6), pas forcément le propriétaire réel du site. Filtrer la liste des
    // sites par ce nom casserait la sélection dès qu'un gestionnaire différent du
    // propriétaire est choisi comme destinataire. On affiche donc tous les sites.
    if (slug === "offre") return sites;
    const clientNom = form.clientNom?.trim();
    if (!clientNom) return sites;
    return sites.filter((s) => s.clientNom === clientNom);
  }, [slug, form.clientNom, sites]);

  function setField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function extractBonCommande() {
    if (!bcFile) return;
    setBcExtracting(true);
    setBcExtractError(null);
    try {
      const fd = new FormData();
      fd.append("file", bcFile);
      const data = await apiFetch<{
        numero: string | null;
        adresse: string | null;
        fournisseur: string | null;
        client: string | null;
        montantTtc: number | null;
        referenceDevis: string | null;
      }>("/api/commandes/extract-bon-commande", { token: readToken(), method: "POST", body: fd });
      if (!data) return;
      setBcExtraction(data);
      setForm((prev) => ({
        ...prev,
        numeroClient: data.numero ?? prev.numeroClient,
      }));
      if (data.client) {
        const match = clients.find((c) => c.raisonSociale.toUpperCase() === data.client?.toUpperCase());
        if (match) {
          setField("clientNom", match.raisonSociale);
          const matchingSites = sites.filter((s) => s.clientNom === match.raisonSociale);
          if (matchingSites.length === 1) setField("siteNom", matchingSites[0].nom);
        }
      }
      if (data.montantTtc != null) {
        setEcheances((prev) =>
          prev.length === 1 && !prev[0].montant.trim() ? [{ ...prev[0], montant: String(data.montantTtc) }] : prev,
        );
      }
      setShowManualFields(true);
    } catch (e) {
      setBcExtractError(e instanceof Error ? e.message : "Erreur lors de l'extraction");
      setShowBcPreview(true);
      // Extraction impossible (image / PDF scanné) : on ouvre directement les champs manuels
      // au lieu de laisser l'admin chercher comment compléter la commande.
      setShowManualFields(true);
    } finally {
      setBcExtracting(false);
    }
  }

  function addEcheance() {
    setEcheances((prev) => [...prev, { montant: "", date: "" }]);
  }

  function removeEcheance(i: number) {
    setEcheances((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  function updateEcheance(i: number, patch: Partial<{ montant: string; date: string }>) {
    setEcheances((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }

  function validate(): string | null {
    if (slug === "contact") {
      if (!form.nom.trim() || !form.prenom.trim()) return "Nom et prénom sont obligatoires.";
      if (!form.entreprise.trim()) return "Le client est obligatoire.";
      if (!isValidEmail(form.email)) return "Email invalide.";
    }
    if (slug === "client") {
      if (!form.raisonSociale.trim()) return "Raison sociale obligatoire.";
      if (!isValidEmail(form.email)) return "Email invalide.";
    }
    if (slug === "site") {
      if (!form.nom.trim() || !form.clientNom.trim()) return "Nom du site et client sont obligatoires.";
    }
    if (slug === "offre" || slug === "commande") {
      if (!form.clientNom.trim() || !form.siteNom.trim()) return "Client et site sont obligatoires.";
      if (slug === "offre" && !MISSION_CALC_TYPES.has(offrePrimaryMission) && !isPositiveNumber(form.montantHt)) {
        return "Montant HT invalide.";
      }
    }
    if (slug === "offre") {
      if (!offreMissionsSelected.length) return "Sélectionnez au moins un type de mission.";
      if (MISSION_CALC_TYPES.has(offrePrimaryMission)) {
        if (!offreMissionCalcEffective) return "Complétez les informations de la mission.";
        const calcErr = validateMissionCalc(offrePrimaryMission, offreMissionCalcEffective, form.dateOffre);
        if (calcErr) return calcErr;
      }
    }
    if (slug === "commande") {
      const valid = echeances.filter((e) => e.montant.trim() && e.date.trim());
      if (!valid.length) return "Indiquez le montant et la date du paiement.";
      if (valid.some((e) => !isPositiveNumber(e.montant))) return "Montant d'échéance invalide.";
    }
    if (slug === "facture") {
      if (!form.numeroCommande.trim()) return "Numéro de commande obligatoire.";
      if (!form.commandeId?.trim()) return "Choisissez une commande dans la liste (lien métier commandeId).";
      if (!isPositiveNumber(form.montantHt)) return "Montant HT invalide.";
      if (!isPositiveNumber(form.frais)) return "Frais invalides.";
    }
    if (slug === "phases") {
      const c = Number(form.conception);
      const e = Number(form.execution);
      if (!Number.isFinite(c) || !Number.isFinite(e) || c < 0 || e < 0 || c + e !== 100) {
        return "Les phases doivent totaliser 100%.";
      }
    }
    return null;
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    const validation = validate();
    if (validation) {
      setErr(validation);
      return;
    }
    const token = readToken();
    const endpoint: Record<Slug, string | null> = {
      contact: "/api/contacts",
      client: "/api/clients",
      site: "/api/sites",
      offre: "/api/offres",
      commande: "/api/commandes",
      facture: "/api/factures",
      phases: null,
    };

    const payloadBySlug: Record<"contact" | "client" | "site" | "commande" | "facture" | "phases", Record<string, string>> = {
      contact: {
        clientNom: form.entreprise,
        civilite: form.civilite,
        nom: form.nom,
        prenom: form.prenom,
        fonction: form.fonction,
        email: form.email,
        telephone: form.telephone,
        mobile: form.mobile,
      },
      client: {
        raisonSociale: form.raisonSociale,
        entite: form.entite,
        email: form.email,
        telephone: form.telephone,
        siret: form.siret,
        codePostal: form.codePostal,
        responsableEmail: form.responsableEmail,
      },
      site: {
        clientNom: form.clientNom,
        nom: form.nom,
        typeSite: form.typeSite,
        adresse: form.adresse ?? "",
      },
      commande: {
        numeroCommande: form.numeroCommande,
        dateCommande: form.dateCommande,
        typeMission: primaryMissionFromSelection(LVO_MISSION_TYPES.filter((t) => commandeMissionPick[t])),
        montantHt: form.montantHt,
        montantFacture: form.montantFacture,
        clientNom: form.clientNom,
        siteNom: form.siteNom,
        numeroClient: form.numeroClient,
      },
      facture: {
        numeroFacture: form.numeroFacture,
        numeroCommande: form.numeroCommande,
        dateFacture: form.dateFacture,
        montantHt: form.montantHt,
        frais: form.frais,
        modeReglement: form.modeReglement,
        clientNom: form.clientNom,
        commandeId: form.commandeId,
      },
      phases: {
        conception: form.conception,
        execution: form.execution,
        note: form.note,
      },
    };

    function postJsonBody(): Record<string, unknown> {
      if (slug === "site") {
        return {
          ...payloadBySlug.site,
          gestionnairePrincipal: gestionnaireClientNom
            ? {
                clientNom: gestionnaireClientNom,
                contactId: gestionnaireContactId ? Number(gestionnaireContactId) : null,
              }
            : null,
          equipements: equipementLignes
            .filter((l) => l.typeLibelle.trim())
            .map((l) => ({ typeLibelle: l.typeLibelle.trim(), quantite: Math.max(0, Math.trunc(l.quantite) || 0) })),
        };
      }
      if (slug === "offre") {
        const mode = form.phasesMode || "SELECTION";
        let phasesLines: { code: string; libelle: string; montantHt: number; inclus: boolean }[] = [];
        if (mode === "ALL" || mode === "SELECTION") {
          phasesLines = refPhases
            .filter((p) => phasePick[p.code])
            .map((p) => ({ code: p.code, libelle: p.libelle, montantHt: p.prixIndicatifHt, inclus: true }));
        } else {
          for (const line of (form.customPhases || "").split("\n")) {
            const t = line.trim();
            if (!t) continue;
            const parts = t.split("|").map((s) => s.trim());
            const code = parts[0];
            if (!code) continue;
            const libelle = parts[1] || code;
            const mt = Number(parts[2]);
            phasesLines.push({
              code,
              libelle: libelle || code,
              montantHt: Number.isFinite(mt) ? mt : 0,
              inclus: true,
            });
          }
        }
        const selectedOffre = LVO_MISSION_TYPES.filter((t) => offreMissionPick[t]);
        const primaryOffre = primaryMissionFromSelection(selectedOffre);
        return {
          typeMission: primaryOffre,
          typeMissions: selectedOffre,
          statut: form.statut,
          montantHt: Number(form.montantHt),
          dateOffre: form.dateOffre || null,
          clientNom: form.clientNom,
          siteNom: form.siteNom,
          phasesMode: mode,
          phasesLines,
          echeancierFacturation: parseEcheJson(form.echeancierFacturation),
          echeancierExecution: parseEcheJson(form.echeancierExecution),
          tauxTva: Number(form.tauxTva),
          consultantEmail: form.consultantEmail,
          gestionnaireNom: form.gestionnaireNom?.trim() || null,
          gestionnaireContact: form.gestionnaireContact?.trim() || null,
          missions: parseEcheJson(form.missions),
          missionCalc: MISSION_CALC_TYPES.has(primaryOffre) ? offreMissionCalcEffective : undefined,
        };
      }
      if (slug === "commande") {
        const valid = echeances.filter((e) => e.montant.trim() && e.date.trim());
        const sumMontant = valid.reduce((s, e) => s + Number(e.montant), 0);
        return {
          dateCommande: valid[0]?.date || new Date().toISOString().slice(0, 10),
          typeMission: "MS",
          typeMissions: ["MS"],
          statut: "EN_COURS",
          montantHt: sumMontant,
          montantFacture: 0,
          clientNom: form.clientNom,
          siteNom: form.siteNom,
          numeroClient: bcExtraction?.numero?.trim() || null,
          modePaiementCommande: paiementMode,
          echeancierPaiement: valid.map((e) => ({ montant: Number(e.montant), date: e.date })),
          offreId: offreOrigine?.offreId ?? null,
        };
      }
      if (slug === "facture") {
        return {
          numeroCommande: form.numeroCommande,
          dateFacture: form.dateFacture || null,
          montantHt: Number(form.montantHt),
          frais: Number(form.frais),
          modeReglement: form.modeReglement,
          clientNom: form.clientNom,
          commandeId: Number(form.commandeId),
        };
      }
      return payloadBySlug[slug as keyof typeof payloadBySlug] as Record<string, unknown>;
    }

    if (slug === "phases") {
      localStorage.setItem("crm-phases-config", JSON.stringify(payloadBySlug.phases));
      setOk("Configuration des phases enregistrée localement.");
      return;
    }

    const target = endpoint[slug];
    if (!target) return;

    setSaving(true);
    void (async () => {
      try {
        const result = await apiFetch(target, {
          token,
          method: "POST",
          body: JSON.stringify(postJsonBody()),
        }) as { id?: number; numeroOffre?: string; numeroCommande?: string; numeroFacture?: string; defaultPassword?: string } | null;
        const passwordNote =
          slug === "contact" && result?.defaultPassword
            ? ` — Mot de passe provisoire espace client : ${result.defaultPassword}`
            : "";
        const refNote =
          (slug === "offre" && result?.numeroOffre) ||
          (slug === "commande" && result?.numeroCommande) ||
          (slug === "facture" && result?.numeroFacture)
            ? ` — Référence : ${result?.numeroOffre ?? result?.numeroCommande ?? result?.numeroFacture}`
            : "";
        setOk(`Enregistrement effectué.${refNote}${passwordNote}`);
        notifyCountsRefresh();
        if (meta.listHref) {
          setTimeout(() => {
            router.push(meta.listHref as string);
            router.refresh();
          }, passwordNote ? 4000 : 500);
        }
      } catch (error) {
        setErr(error instanceof Error ? error.message : "Erreur lors de l'enregistrement.");
      } finally {
        setSaving(false);
      }
    })();
  }

  const hints = referenceHints();
  // Désactive le bouton tant que l'offre n'est pas complète (type de mission choisi, calcul
  // honoraires valide…) plutôt que de laisser cliquer pour ne découvrir l'erreur qu'après coup.
  const offreValidationError = slug === "offre" ? validate() : null;

  return (
    <>
      <CrmPageHeader
        title={meta.title}
        subtitle={meta.subtitle}
        actions={[
          ...(meta.listHref && meta.listLabel ? [{ label: meta.listLabel, href: meta.listHref }] : []),
          { label: "← Dashboard", href: "/crm/dashboard" },
        ]}
      />
      {err ? <p className="crm-alert crm-alert--error mb-3">{err}</p> : null}
      {ok ? <p className="crm-alert crm-alert--success mb-3">{ok}</p> : null}

      <form className="fcard" onSubmit={submit}>
        <div className="fcard-hdr">
          <div>
            <h2>{meta.title}</h2>
            <div className="fcard-hdr-sub">Renseignez les champs puis validez.</div>
          </div>
        </div>
        <div className="fcard-body crm-form-grid">
          {(slug === "contact" || slug === "client" || slug === "site" || slug === "offre" || slug === "commande" || slug === "facture") && (
            <>
              {slug === "contact" ? (
                <ContactFormFields
                  idPrefix={fid}
                  values={{
                    civilite: form.civilite,
                    prenom: form.prenom,
                    nom: form.nom,
                    entreprise: form.entreprise,
                    fonction: form.fonction,
                    email: form.email,
                    telephone: form.telephone,
                    mobile: form.mobile ?? "",
                  }}
                  onChange={(patch) => {
                    for (const [k, v] of Object.entries(patch)) setField(k, v);
                  }}
                  clients={clients}
                  onClientCreated={(client) => setClients((prev) => [...prev, client])}
                />
              ) : null}

              {slug === "client" ? (
                <>
                  <div className="crm-stack crm-span-2">
                    <p className="crm-stack-title">
                      <span className="crm-stack-title__icon" aria-hidden>◎</span> Identité
                    </p>
                    <div className="crm-form-grid crm-form-grid--tight">
                      <label className="crm-field crm-span-2">
                        <span className="crm-label">
                          Raison sociale <span className="crm-req">*</span>
                        </span>
                        <input className="crm-input" value={form.raisonSociale} onChange={(e) => setField("raisonSociale", e.target.value)} placeholder="Société anonyme…" autoComplete="organization" />
                      </label>
                      <label className="crm-field">
                        <span className="crm-label">Entité / département</span>
                        <input className="crm-input" value={form.entite} onChange={(e) => setField("entite", e.target.value)} placeholder="Siège, agence…" />
                      </label>
                      <label className="crm-field">
                        <span className="crm-label">
                          SIRET <span className="crm-opt">(optionnel)</span>
                        </span>
                        <input className="crm-input" value={form.siret} onChange={(e) => setField("siret", e.target.value)} placeholder="14 chiffres" inputMode="numeric" />
                      </label>
                    </div>
                  </div>
                  <div className="crm-stack crm-span-2">
                    <p className="crm-stack-title">
                      <span className="crm-stack-title__icon" aria-hidden>@</span> Coordonnées
                    </p>
                    <div className="crm-form-grid crm-form-grid--tight">
                      <label className="crm-field">
                        <span className="crm-label">Téléphone</span>
                        <input className="crm-input" type="tel" value={form.telephone} onChange={(e) => setField("telephone", e.target.value)} placeholder="+33 …" />
                      </label>
                      <label className="crm-field">
                        <span className="crm-label">Email</span>
                        <input className="crm-input" type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} placeholder="contact@entreprise.fr" />
                      </label>
                      <label className="crm-field crm-span-2">
                        <span className="crm-label">Responsable client (suivi)</span>
                        <input
                          className="crm-input"
                          type="email"
                          value={form.responsableEmail ?? ""}
                          onChange={(e) => setField("responsableEmail", e.target.value)}
                          placeholder="contact.technique@client.fr"
                        />
                        <p className="crm-hint">Référent côté client pour le suivi des étapes (distinct de l’email société).</p>
                      </label>
                    </div>
                  </div>
                </>
              ) : null}

              {slug === "site" ? (
                <>
                  <div className="crm-stack crm-span-2">
                    <p className="crm-stack-title">
                      <span className="crm-stack-title__icon" aria-hidden>▣</span> Identité du site
                    </p>
                    <div className="crm-form-grid crm-form-grid--tight">
                      <label className="crm-field">
                        <span className="crm-label">
                          Nom du site <span className="crm-req">*</span>
                        </span>
                        <input className="crm-input" value={form.nom} onChange={(e) => setField("nom", e.target.value)} placeholder="Libellé interne du site" />
                      </label>
                      <label className="crm-field">
                        <span className="crm-label">Type de site</span>
                        <select
                          className="crm-select"
                          value={siteTypeAutre ? SITE_TYPE_AUTRE : form.typeSite}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === SITE_TYPE_AUTRE) {
                              setSiteTypeAutre(true);
                              setField("typeSite", "");
                            } else {
                              setSiteTypeAutre(false);
                              setField("typeSite", v);
                            }
                          }}
                        >
                          <option value="">Choisir un type…</option>
                          {SITE_TYPE_OPTIONS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                          <option value={SITE_TYPE_AUTRE}>Autre (saisie libre)…</option>
                        </select>
                        {siteTypeAutre ? (
                          <input
                            className="crm-input mt-1"
                            value={form.typeSite}
                            onChange={(e) => setField("typeSite", e.target.value)}
                            placeholder="Précisez le type de site"
                            autoFocus
                          />
                        ) : null}
                      </label>
                      <label className="crm-field crm-span-2">
                        <span className="crm-label">Adresse</span>
                        <input className="crm-input" value={form.adresse ?? ""} onChange={(e) => setField("adresse", e.target.value)} placeholder="Voie, code postal, ville" autoComplete="street-address" />
                      </label>
                    </div>
                  </div>
                  <div className="crm-stack crm-span-2">
                    <p className="crm-stack-title">
                      <span className="crm-stack-title__icon" aria-hidden>◎</span> Propriétaire
                    </p>
                    <div className="crm-form-grid crm-form-grid--tight">
                      <div className="crm-field crm-span-2">
                        <label htmlFor={`${fid}-site-client`} className="crm-label">
                          Propriétaire <span className="crm-req">*</span>
                        </label>
                        <select
                          id={`${fid}-site-client`}
                          className="crm-select"
                          value={siteClientAutre ? SITE_CLIENT_AUTRE : form.clientNom}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === SITE_CLIENT_AUTRE) {
                              setSiteClientAutre(true);
                              setField("clientNom", "");
                            } else {
                              setSiteClientAutre(false);
                              setField("clientNom", v);
                            }
                          }}
                        >
                          <option value="">Choisir un client…</option>
                          {siteClientOptions.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                          <option value={SITE_CLIENT_AUTRE}>Autre (saisie libre)…</option>
                        </select>
                        {siteClientAutre ? (
                          <input
                            className="crm-input"
                            style={{ marginTop: 8 }}
                            value={form.clientNom}
                            onChange={(e) => setField("clientNom", e.target.value)}
                            placeholder="Nom du client"
                            autoFocus
                          />
                        ) : null}
                        {agenceScope !== "ALL" ? (
                          <p className="crm-hint">
                            Périmètre actif : {scopeDef(agenceScope).label} — seuls les clients de cette agence sont
                            proposés (le site apparaîtra dans la liste avec le même périmètre).
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="crm-stack crm-span-2">
                    <p className="crm-stack-title">
                      <span className="crm-stack-title__icon" aria-hidden>◆</span> Gestionnaire principal
                    </p>
                    <div className="crm-form-grid crm-form-grid--tight">
                      <div className="crm-field">
                        <label htmlFor={`${fid}-site-gest-client`} className="crm-label">
                          Client gestionnaire <span className="crm-opt">(optionnel)</span>
                        </label>
                        <div style={{ display: "flex", gap: 8 }}>
                          <select
                            id={`${fid}-site-gest-client`}
                            className="crm-select"
                            style={{ flex: 1 }}
                            value={gestionnaireClientNom}
                            onChange={(e) => {
                              setGestionnaireClientNom(e.target.value);
                              setGestionnaireContactId("");
                            }}
                          >
                            <option value="">Aucun (à ajouter plus tard)…</option>
                            {siteClientOptions.map((name) => (
                              <option key={name} value={name}>
                                {name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="cbtn cbtn-ghost cbtn-sm"
                            onClick={() => {
                              setSiteNewClientPrefill("");
                              setSiteNewClientOpen(true);
                            }}
                          >
                            + Nouveau client
                          </button>
                        </div>
                        <p className="crm-hint">
                          Indépendant du Propriétaire — le gestionnaire reçoit les offres pour ce site (syndic,
                          prestataire, mandataire…).
                        </p>
                      </div>
                      {gestionnaireClientNom ? (
                        <div className="crm-field">
                          <label htmlFor={`${fid}-site-gest-contact`} className="crm-label">
                            Contact (fonction gestionnaire)
                          </label>
                          <select
                            id={`${fid}-site-gest-contact`}
                            className="crm-select"
                            value={gestionnaireContactId}
                            onChange={(e) => setGestionnaireContactId(e.target.value)}
                            disabled={!gestionnaireContactOptions.length}
                          >
                            <option value="">
                              {gestionnaireContactOptions.length ? "Choisir un contact…" : "Aucun contact éligible"}
                            </option>
                            {gestionnaireContactOptions.map((c) => (
                              <option key={c.id} value={String(c.id)}>
                                {c.prenom} {c.nom} — {c.fonction}
                              </option>
                            ))}
                          </select>
                          {!gestionnaireContactOptions.length ? (
                            <p className="crm-hint">
                              Aucun contact avec la fonction « Gestionnaire » pour ce client — complétez d&apos;abord
                              sa fiche Contact (champ Fonction).
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <EquipementsQuantiteFields
                    lignes={equipementLignes}
                    onChange={setEquipementLignes}
                    typesEquipement={typesEquipement}
                  />
                </>
              ) : null}

              {slug === "offre" || slug === "commande" ? (
                <>
                  {slug === "commande" && offreOrigine ? (
                    <div className="crm-stack crm-span-2">
                      <p className="crm-alert crm-alert--info">
                        Commande créée à partir de l&apos;offre <strong>{offreOrigine.numeroOffre || "—"}</strong> —
                        client, site et montant ont été repris automatiquement ; vérifiez-les ci-dessous.
                      </p>
                    </div>
                  ) : null}
                  {slug === "commande" ? (
                    <div className="crm-stack crm-span-2">
                      <p className="crm-stack-title">
                        <span className="crm-stack-title__icon" aria-hidden>⇪</span> Bon de commande
                      </p>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <input
                          type="file"
                          accept="application/pdf,image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null;
                            setBcFile(file);
                            setBcExtraction(null);
                            setBcExtractError(null);
                            if (file && file.type.startsWith("image/")) {
                              // Image : pas de texte à extraire, on ouvre directement la saisie manuelle
                              // au lieu de tenter une extraction PDF qui échouerait à coup sûr.
                              setBcExtractError("Image détectée — l'extraction automatique ne fonctionne que sur un PDF texte.");
                              setShowBcPreview(true);
                              setShowManualFields(true);
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="cbtn cbtn-ghost cbtn-sm"
                          disabled={!bcFile || bcExtracting || bcFile.type.startsWith("image/")}
                          onClick={() => void extractBonCommande()}
                        >
                          {bcExtracting ? "Extraction…" : "Extraire les données"}
                        </button>
                        {bcPreviewUrl ? (
                          <button type="button" className="cbtn cbtn-ghost cbtn-sm" onClick={() => setShowBcPreview(true)}>
                            Voir le document
                          </button>
                        ) : null}
                      </div>
                      <p className="crm-hint">
                        PDF ou photo/scan (image) acceptés. Au lieu de tout saisir à la main : dépose le bon de
                        commande, le n° du bon client, l&apos;adresse, le fournisseur et le client sont détectés
                        automatiquement à partir d&apos;un PDF texte — si le client détecté n&apos;a qu&apos;un seul
                        site, il est aussi pré-sélectionné, et le montant détecté pré-remplit la première échéance (à
                        vérifier). Pour une image ou un PDF scanné, l&apos;extraction automatique échoue : complétez
                        les champs Client / Site / Paiement ci-dessous à partir du document affiché avec « Voir le
                        document ». Le n° de commande LVO interne (ex. LVO-MS-2026-001) est attribué automatiquement
                        à l&apos;enregistrement.
                      </p>
                      {bcExtractError ? (
                        <p className="crm-alert crm-alert--error mt-1">
                          {bcExtractError} — le document est probablement scanné (image, pas de texte). Consultez-le avec
                          « Voir le document » et remplissez Client / Site / Paiement à la main ci-dessous.
                        </p>
                      ) : null}
                      {!showManualFields ? (
                        <button
                          type="button"
                          className="cbtn cbtn-ghost cbtn-sm mt-1"
                          onClick={() => setShowManualFields(true)}
                        >
                          Remplir Client / Site / Paiement manuellement
                        </button>
                      ) : null}
                      {bcExtraction ? (
                        <dl className="crm-hint" style={{ display: "grid", gridTemplateColumns: "100px 1fr", rowGap: 4, marginTop: 6 }}>
                          <dt>N°</dt>
                          <dd>{bcExtraction.numero ?? "—"}</dd>
                          <dt>Adresse</dt>
                          <dd>{bcExtraction.adresse ?? "—"}</dd>
                          <dt>Fournisseur</dt>
                          <dd>{bcExtraction.fournisseur ?? "—"}</dd>
                          <dt>Client détecté</dt>
                          <dd>{bcExtraction.client ?? "—"}</dd>
                          <dt>Montant TTC</dt>
                          <dd>{bcExtraction.montantTtc != null ? `${bcExtraction.montantTtc.toLocaleString("fr-FR")} €` : "—"} (à vérifier avant de saisir le Montant HT)</dd>
                          <dt>Réf. devis</dt>
                          <dd>{bcExtraction.referenceDevis ?? "—"}</dd>
                        </dl>
                      ) : null}
                    </div>
                  ) : null}
                  {slug === "offre" ? (
                    <div className="crm-stack crm-span-2">
                      <p className="crm-stack-title">
                        <span className="crm-stack-title__icon" aria-hidden>▤</span> Référence &amp; date
                      </p>
                      <div className="crm-form-grid crm-form-grid--tight">
                        <div className="crm-field crm-span-2">
                          <span className="crm-label">Référence offre</span>
                          <p className="crm-hint">
                            Générée automatiquement à l&apos;enregistrement, format {hints.offre} — le TYPE correspond au type
                            « principal » parmi les missions cochées (ordre LVO : A, ADC, MOE…).
                          </p>
                        </div>
                        <label className="crm-field">
                          <span className="crm-label">Date de l’offre</span>
                          <input className="crm-input" type="date" value={form.dateOffre} onChange={(e) => setField("dateOffre", e.target.value)} />
                        </label>
                      </div>
                    </div>
                  ) : null}
                  {slug === "offre" || showManualFields ? (
                  <div className="crm-stack crm-span-2">
                    <p className="crm-stack-title">
                      <span className="crm-stack-title__icon" aria-hidden>◎</span> Client &amp; site
                    </p>
                    <div className="crm-form-grid crm-form-grid--tight">
                      <div className="crm-field">
                        <label htmlFor={`${fid}-cmd-client`} className="crm-label">
                          Client <span className="crm-req">*</span>
                        </label>
                        <select id={`${fid}-cmd-client`} className="crm-select" value={form.clientNom} onChange={(e) => setField("clientNom", e.target.value)}>
                          {slug === "offre" ? (
                            <>
                              {[
                                ...new Map(
                                  (offreParties?.options ?? clients.map((c) => ({ clientNom: c.raisonSociale, label: c.raisonSociale }))).map(
                                    (o) => [o.clientNom, o] as const,
                                  ),
                                ).values(),
                              ].map((o) => (
                                <option key={o.clientNom} value={o.clientNom}>
                                  {o.label}
                                </option>
                              ))}
                            </>
                          ) : (
                            <>
                              <option value="">Choisir un client…</option>
                              {clients.map((c) => (
                                <option key={c.id} value={c.raisonSociale}>
                                  {c.raisonSociale}
                                </option>
                              ))}
                            </>
                          )}
                        </select>
                      </div>
                      <div className="crm-field">
                        <label htmlFor={`${fid}-cmd-site`} className="crm-label">
                          Site <span className="crm-req">*</span>
                        </label>
                        <select id={`${fid}-cmd-site`} className="crm-select" value={form.siteNom} onChange={(e) => setField("siteNom", e.target.value)}>
                          <option value="">Choisir un site…</option>
                          {filteredSites.map((s) => (
                            <option key={s.id} value={s.nom}>
                              {s.nom}
                            </option>
                          ))}
                        </select>
                      </div>
                      {slug === "offre" ? (
                        <>
                          <p className="crm-hint crm-span-2">
                            Client destinataire : propriétaire du site et/ou gestionnaires actifs — défaut : gestionnaire principal si défini.
                          </p>
                          <div className="crm-field crm-span-2">
                            <label htmlFor={`${fid}-offre-gest`} className="crm-label">
                              Gestionnaire (syndic / prestataire / propriétaire)
                            </label>
                            <select
                              id={`${fid}-offre-gest`}
                              className="crm-select"
                              value={form.gestionnaireNom}
                              disabled={!offreParties?.options.length}
                              onChange={(e) => {
                                const nom = e.target.value;
                                const opt = offreParties?.options.find((o) => o.clientNom === nom);
                                setField("gestionnaireNom", nom);
                                const matchContact = offreContacts.find((c) => c.id === opt?.contactId);
                                if (matchContact) {
                                  setField("gestionnaireContact", `${matchContact.prenom} ${matchContact.nom}`.trim());
                                  setOffreGestContactAutre(false);
                                } else {
                                  setField("gestionnaireContact", opt?.responsableContact ?? "");
                                  setOffreGestContactAutre(true);
                                }
                              }}
                            >
                              <option value="">Choisir…</option>
                              {(offreParties?.options ?? []).map((o) => (
                                <option key={`gest-${o.clientNom}`} value={o.clientNom}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                            <p className="crm-hint">
                              Aligné sur les gestionnaires du site (Phase 6) : syndic, prestataire ou propriétaire du site.
                              Le gestionnaire n&apos;est pas forcément le propriétaire — son contact vient de la fiche
                              Site (Gestionnaire principal) quand il est renseigné.
                            </p>
                          </div>
                          <div className="crm-field crm-span-2">
                            <label htmlFor={`${fid}-offre-gest-contact`} className="crm-label">
                              Contact gestionnaire (personne, fonction gestionnaire)
                            </label>
                            <select
                              id={`${fid}-offre-gest-contact`}
                              className="crm-select"
                              value={offreGestContactAutre ? OFFRE_GEST_CONTACT_AUTRE : form.gestionnaireContact}
                              disabled={!form.gestionnaireNom}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === OFFRE_GEST_CONTACT_AUTRE) {
                                  setOffreGestContactAutre(true);
                                  setField("gestionnaireContact", "");
                                } else {
                                  setOffreGestContactAutre(false);
                                  setField("gestionnaireContact", v);
                                }
                              }}
                            >
                              <option value="">
                                {offreGestContactOptions.length ? "Choisir un contact…" : "Aucun contact éligible"}
                              </option>
                              {offreGestContactOptions.map((c) => (
                                <option key={c.id} value={`${c.prenom} ${c.nom}`.trim()}>
                                  {c.prenom} {c.nom} — {c.fonction}
                                  {c.email ? ` · ${c.email}` : ""}
                                  {c.telephone ? ` · ${c.telephone}` : ""}
                                </option>
                              ))}
                              <option value={OFFRE_GEST_CONTACT_AUTRE}>Autre (saisie libre)…</option>
                            </select>
                            {offreGestContactAutre ? (
                              <input
                                className="crm-input"
                                style={{ marginTop: 8 }}
                                value={form.gestionnaireContact ?? ""}
                                onChange={(e) => setField("gestionnaireContact", e.target.value)}
                                placeholder="Nom, email ou téléphone du référent"
                                autoFocus
                              />
                            ) : null}
                            <p className="crm-hint">
                              Contacts de la fiche du gestionnaire choisi ci-dessus, avec la fonction « Gestionnaire ».
                              Prérempli automatiquement si le site a un contact gestionnaire renseigné.
                            </p>
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>
                  ) : null}
                  {slug === "offre" ? (
                    <div className="crm-stack crm-span-2">
                      <p className="crm-stack-title">
                        <span className="crm-stack-title__icon" aria-hidden>✓</span> Mission, statut &amp; montant
                      </p>
                      <div className="crm-form-grid crm-form-grid--tight">
                        <div className="crm-field crm-span-2">
                          <span className="crm-label">Types de mission (sélection multiple)</span>
                          <div className="crm-checkbox-grid mt-1">
                            {LVO_MISSION_TYPES.map((t) => (
                              <label key={`offre-m-${t}`} className="crm-field-check">
                                <input
                                  type="checkbox"
                                  checked={!!offreMissionPick[t]}
                                  onChange={() => {
                                    setOffreMissionPick((prev) => {
                                      const next = { ...prev, [t]: !prev[t] };
                                      const any = LVO_MISSION_TYPES.some((x) => next[x]);
                                      if (!any) return { ...prev, [t]: true };
                                      return next;
                                    });
                                  }}
                                />
                                {t}
                              </label>
                            ))}
                          </div>
                          {!offreMissionsSelected.length ? (
                            <p className="crm-hint mt-1">Sélectionnez au moins un type de mission pour continuer.</p>
                          ) : offreMissionsSelected.length > 1 ? (
                            <p className="crm-hint mt-1">
                              Type principal pour le n° d&apos;offre : <strong>{offrePrimaryMission}</strong>
                            </p>
                          ) : null}
                        </div>
                        <label className="crm-field">
                          <span className="crm-label">Statut</span>
                          <select className="crm-select" value={form.statut} onChange={(e) => setField("statut", e.target.value)}>
                            {CRM_OFFRE_STATUTS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        {!MISSION_CALC_TYPES.has(offrePrimaryMission) ? (
                          <label className="crm-field crm-span-2">
                            <span className="crm-label">
                              Montant HT (€) <span className="crm-req">*</span>
                            </span>
                            <input className="crm-input" inputMode="decimal" value={form.montantHt} onChange={(e) => setField("montantHt", e.target.value)} placeholder="0,00" />
                          </label>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  {slug === "offre" && MISSION_CALC_TYPES.has(offrePrimaryMission) && offreMissionCalcEffective ? (
                    <MissionCalcFields
                      key={offrePrimaryMission}
                      typeMission={offrePrimaryMission}
                      value={offreMissionCalcEffective}
                      onChange={setOffreMissionCalc}
                      dateOffreIso={form.dateOffre}
                      nbAscenseursSuggestion={offreNbAscenseursSuggestion}
                    />
                  ) : null}
                  {slug === "commande" && showManualFields ? (
                    <div className="crm-stack crm-span-2">
                      <p className="crm-stack-title">
                        <span className="crm-stack-title__icon" aria-hidden>€</span> Paiement <span className="crm-req">*</span>
                      </p>
                      <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
                        <label className="crm-field-check">
                          <input
                            type="radio"
                            checked={paiementMode === "UNIQUE"}
                            onChange={() => {
                              setPaiementMode("UNIQUE");
                              setEcheances((prev) => (prev.length > 1 ? prev.slice(0, 1) : prev.length === 0 ? [{ montant: "", date: "" }] : prev));
                            }}
                          />
                          Payée en une seule fois
                        </label>
                        <label className="crm-field-check">
                          <input type="radio" checked={paiementMode === "ECHELONNE"} onChange={() => setPaiementMode("ECHELONNE")} />
                          Payée en plusieurs fois (échéances)
                        </label>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {echeances.map((e, i) => (
                          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <input
                              className="crm-input"
                              inputMode="decimal"
                              style={{ flex: 1 }}
                              value={e.montant}
                              onChange={(ev) => updateEcheance(i, { montant: ev.target.value })}
                              placeholder={paiementMode === "ECHELONNE" ? `Montant échéance ${i + 1} (€)` : "Montant (€)"}
                            />
                            <input
                              className="crm-input"
                              type="date"
                              style={{ flex: 1 }}
                              value={e.date}
                              onChange={(ev) => updateEcheance(i, { date: ev.target.value })}
                            />
                            {paiementMode === "ECHELONNE" ? (
                              <button
                                type="button"
                                className="cbtn cbtn-ghost cbtn-sm"
                                disabled={echeances.length <= 1}
                                onClick={() => removeEcheance(i)}
                              >
                                ✕
                              </button>
                            ) : null}
                          </div>
                        ))}
                        {paiementMode === "ECHELONNE" ? (
                          <button type="button" className="cbtn cbtn-ghost cbtn-sm" style={{ alignSelf: "flex-start" }} onClick={addEcheance}>
                            + Ajouter une échéance
                          </button>
                        ) : null}
                      </div>
                      <p className="crm-hint">
                        {paiementMode === "ECHELONNE"
                          ? "Indiquez le montant et la date de chaque échéance — leur somme constitue le Montant HT de la commande."
                          : "Montant et date du paiement unique — devient le Montant HT de la commande."}
                      </p>
                    </div>
                  ) : null}
                </>
              ) : null}

              {slug === "facture" ? (
                <>
                  <div className="crm-field crm-span-2">
                    <span className="crm-label">Numéro de facture</span>
                    <p className="crm-hint">Généré automatiquement à l&apos;enregistrement, format {hints.facture}</p>
                  </div>
                  <label className="crm-field">
                    <span className="crm-label">Date de facture</span>
                    <input className="crm-input" type="date" value={form.dateFacture} onChange={(e) => setField("dateFacture", e.target.value)} />
                  </label>
                  <div className="crm-field crm-span-2">
                    <label htmlFor={`${fid}-fac-cmd`} className="crm-label">
                      Commande liée <span className="crm-req">*</span>
                    </label>
                    <select id={`${fid}-fac-cmd`} className="crm-select" value={form.numeroCommande} onChange={(e) => setField("numeroCommande", e.target.value)}>
                      <option value="">Choisir une commande…</option>
                      {commandes.map((c) => (
                        <option key={c.id} value={c.numeroCommande}>
                          {c.numeroCommande} — {c.clientNom}
                        </option>
                      ))}
                    </select>
                  </div>
                  {(() => {
                    const cmdSel = commandes.find((c) => c.numeroCommande === form.numeroCommande);
                    return cmdSel?.numeroClient ? (
                      <p className="crm-hint crm-span-2">
                        N° commande client (PDF facture) : <strong>{cmdSel.numeroClient}</strong>
                      </p>
                    ) : null;
                  })()}
                  <label className="crm-field">
                    <span className="crm-label">Client (libellé)</span>
                    <input className="crm-input" value={form.clientNom} onChange={(e) => setField("clientNom", e.target.value)} placeholder="Raison sociale affichée" />
                  </label>
                  <label className="crm-field">
                    <span className="crm-label">Mode de règlement</span>
                    <input className="crm-input" value={form.modeReglement} onChange={(e) => setField("modeReglement", e.target.value)} placeholder="VIREMENT, chèque…" />
                  </label>
                  <label className="crm-field">
                    <span className="crm-label">
                      Montant HT (€) <span className="crm-req">*</span>
                    </span>
                    <input className="crm-input" inputMode="decimal" value={form.montantHt} onChange={(e) => setField("montantHt", e.target.value)} placeholder="0,00" />
                  </label>
                  <label className="crm-field">
                    <span className="crm-label">
                      Frais (€) <span className="crm-req">*</span>
                    </span>
                    <input className="crm-input" inputMode="decimal" value={form.frais} onChange={(e) => setField("frais", e.target.value)} placeholder="0,00" />
                  </label>
                </>
              ) : null}
            </>
          )}

          {slug === "phases" ? (
            <>
              <label className="crm-field">
                <span className="crm-label">Part conception (%)</span>
                <input className="crm-input" value={form.conception} onChange={(e) => setField("conception", e.target.value)} placeholder="40" inputMode="numeric" />
              </label>
              <label className="crm-field">
                <span className="crm-label">Part exécution (%)</span>
                <input className="crm-input" value={form.execution} onChange={(e) => setField("execution", e.target.value)} placeholder="60" inputMode="numeric" />
              </label>
              <label className="crm-field crm-span-2">
                <span className="crm-label">Notes internes</span>
                <textarea className="crm-textarea min-h-28" value={form.note} onChange={(e) => setField("note", e.target.value)} placeholder="Règles de facturation, jalons…" />
              </label>
            </>
          ) : null}

          <div className="crm-span-2 mt-1 flex flex-col gap-3 border-t border-[var(--g200)] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="crm-hint m-0">Les champs marqués d’une astérisque orange sont requis pour un dossier complet.</p>
            <button type="submit" className="cbtn cbtn-orange shrink-0" disabled={saving || !!offreValidationError}>
              {saving ? "Enregistrement..." : "Valider"}
            </button>
          </div>
        </div>
      </form>

      {showBcPreview && bcPreviewUrl ? (
        <div className="crm-modal-backdrop" onClick={() => setShowBcPreview(false)}>
          <div
            className="crm-modal-shell fcard crm-modal-shell--xl"
            style={{ height: "85vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="fcard-hdr crm-modal-hdr">
              <div className="min-w-0 flex-1">
                <h2>Aperçu du bon de commande</h2>
                <div className="fcard-hdr-sub">{bcFile?.name}</div>
              </div>
              {!showManualFields ? (
                <button type="button" className="cbtn cbtn-orange cbtn-sm shrink-0" onClick={() => setShowManualFields(true)}>
                  Remplir manuellement
                </button>
              ) : null}
              <button type="button" className="cbtn cbtn-ghost cbtn-sm shrink-0" onClick={() => setShowBcPreview(false)}>
                Fermer
              </button>
            </div>
            <div className="fcard-body" style={{ flex: 1, padding: 0, display: "flex" }}>
              <iframe src={bcPreviewUrl} title="Aperçu du bon de commande" style={{ width: "100%", height: "100%", border: "none" }} />
            </div>
          </div>
        </div>
      ) : null}

      {slug === "site" ? (
        <NewClientModal
          open={siteNewClientOpen}
          prefillRaisonSociale={siteNewClientPrefill}
          onClose={() => setSiteNewClientOpen(false)}
          onCreated={(client) => {
            setClients((prev) => [...prev, client]);
            setGestionnaireClientNom(client.raisonSociale);
            setGestionnaireContactId("");
            setSiteNewClientOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
