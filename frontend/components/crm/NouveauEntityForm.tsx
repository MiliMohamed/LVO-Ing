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
import {
  LVO_MISSION_TYPES,
  primaryMissionFromSelection,
  referenceHints,
  validateCommandeReference,
  validateFactureReference,
  validateOffreReference,
} from "@/lib/reference-lvo";
import { CRM_COMMANDE_STATUTS, CRM_OFFRE_STATUTS } from "@/lib/crm-workflow";
import { readToken } from "@/lib/token-storage";
import type { ClientRow, CommandeRow, SiteRow } from "@/lib/types";

import { ContactFormFields } from "@/components/crm/forms/ContactFormFields";
import { CrmFormActions, CrmPageHeader } from "@/components/crm/ui";

import { PlanningExecutionEditor } from "./PlanningExecutionEditor";

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
    dateOffre: "",
    clientNom: "",
    siteNom: "",
    phasesMode: "SELECTION",
    consultantEmail: "",
    gestionnaireNom: "",
    gestionnaireContact: "",
    tauxTva: "20",
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
    statut: "EN_ATTENTE",
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

function clientIsDomTom(c: ClientRow): boolean {
  const e = String(c.entite || "").trim();
  if (/^(97|98)/.test(e.replace(/\s/g, ""))) return true;
  if (["974", "971", "972", "973", "976", "978"].includes(e)) return true;
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
    options: { clientNom: string; label: string; role: string; responsableContact: string | null }[];
  } | null>(null);
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
  const [agenceScope, setAgenceScope] = useState<AgenceScopeId>("ALL");

  useEffect(() => {
    setAgenceScope(readAgenceScope());
    return onAgenceScopeChange(() => setAgenceScope(readAgenceScope()));
  }, []);

  const clientsForSite = useMemo(() => {
    if (slug !== "site" || agenceScope === "ALL") return clients;
    return clients.filter((c) => rowMatchesAgenceScope(c as unknown as Record<string, unknown>, agenceScope));
  }, [clients, slug, agenceScope]);

  useEffect(() => {
    if (!["site", "offre", "commande", "facture"].includes(slug)) return;
    const token = readToken();
    let cancel = false;
    void (async () => {
      try {
        const calls: Promise<unknown>[] = [];
        calls.push(apiFetch("/api/clients", { token }));
        if (slug === "offre" || slug === "commande") calls.push(apiFetch("/api/sites", { token }));
        if (slug === "facture") calls.push(apiFetch("/api/commandes", { token }));
        const data = await Promise.all(calls);
        if (cancel) return;
        setClients(Array.isArray(data[0]) ? (data[0] as ClientRow[]) : []);
        if (slug === "offre" || slug === "commande") setSites(Array.isArray(data[1]) ? (data[1] as SiteRow[]) : []);
        if (slug === "facture") setCommandes(Array.isArray(data[1]) ? (data[1] as CommandeRow[]) : []);
      } catch {
        if (!cancel) setErr("Impossible de charger les référentiels (clients/sites/commandes).");
      }
    })();
    return () => {
      cancel = true;
    };
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
          options: { clientNom: string; label: string; role: string; responsableContact: string | null }[];
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
            prev.tauxTva && prev.tauxTva !== "20"
              ? prev.tauxTva
              : String(st?.tvaMetropolePercent ?? 20),
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

  useEffect(() => {
    if (slug !== "offre") return;
    const pick: Record<string, boolean> = {};
    for (const t of LVO_MISSION_TYPES) pick[t] = false;
    pick.MS = true;
    setOffreMissionPick(pick);
  }, [slug]);

  const offreMissionsSelected = useMemo(
    () => LVO_MISSION_TYPES.filter((t) => offreMissionPick[t]),
    [offreMissionPick],
  );
  const offrePrimaryMission = useMemo(
    () => (offreMissionsSelected.length ? primaryMissionFromSelection(offreMissionsSelected) : "MS"),
    [offreMissionsSelected],
  );

  useEffect(() => {
    if (slug !== "offre" || form.phasesMode !== "SELECTION") return;
    const sum = refPhases.filter((r) => phasePick[r.code]).reduce((s, r) => s + r.prixIndicatifHt, 0);
    setForm((f) => (f.montantHt === String(sum) ? f : { ...f, montantHt: String(sum) }));
  }, [slug, form.phasesMode, phasePick, refPhases]);

  useEffect(() => {
    if (slug !== "offre" || form.phasesMode !== "ALL" || !refPhases.length) return;
    const pick: Record<string, boolean> = {};
    let sum = 0;
    for (const p of refPhases) {
      pick[p.code] = true;
      sum += p.prixIndicatifHt;
    }
    setPhasePick(pick);
    setForm((prev) => ({ ...prev, montantHt: String(sum) }));
  }, [slug, form.phasesMode, refPhases]);

  const filteredSites = useMemo(() => {
    const clientNom = form.clientNom?.trim();
    if (!clientNom) return sites;
    return sites.filter((s) => s.clientNom === clientNom);
  }, [form.clientNom, sites]);

  function setField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): string | null {
    if (slug === "contact") {
      if (!form.nom.trim() || !form.prenom.trim()) return "Nom et prénom sont obligatoires.";
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
      if (!isPositiveNumber(form.montantHt)) return "Montant HT invalide.";
      if (slug === "commande" && !isPositiveNumber(form.montantFacture)) return "Montant facturé invalide.";
    }
    if (slug === "offre") {
      if (!offreMissionsSelected.length) return "Sélectionnez au moins un type de mission.";
      const refErr = validateOffreReference(form.numeroOffre, offrePrimaryMission);
      if (refErr) return refErr;
      const mode = form.phasesMode || "SELECTION";
      if (mode === "SELECTION") {
        const any = refPhases.some((p) => phasePick[p.code]);
        if (!any) return "Sélectionnez au moins une phase du référentiel, ou passez en mode « Tout » / « Personnalisé ».";
      }
      if (mode === "CUSTOM") {
        const lines = (form.customPhases || "").split("\n").filter((l) => l.trim());
        if (!lines.length) return "Mode personnalisé : une ligne minimum (format CODE|Libellé|montant HT).";
      }
    }
    if (slug === "commande") {
      const selected = LVO_MISSION_TYPES.filter((t) => commandeMissionPick[t]);
      if (!selected.length) return "Sélectionnez au moins un type de mission.";
      const primary = primaryMissionFromSelection(selected);
      const refErr = validateCommandeReference(form.numeroCommande, primary);
      if (refErr) return refErr;
    }
    if (slug === "facture") {
      if (!form.numeroCommande.trim()) return "Numéro de commande obligatoire.";
      if (!form.commandeId?.trim()) return "Choisissez une commande dans la liste (lien métier commandeId).";
      const facErr = validateFactureReference(form.numeroFacture);
      if (facErr) return facErr;
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
          numeroOffre: form.numeroOffre,
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
        };
      }
      if (slug === "commande") {
        const selected = LVO_MISSION_TYPES.filter((t) => commandeMissionPick[t]);
        const primary = primaryMissionFromSelection(selected);
        return {
          numeroCommande: form.numeroCommande,
          dateCommande: form.dateCommande || null,
          typeMission: primary,
          typeMissions: selected,
          statut: form.statut?.trim() || "EN_ATTENTE",
          montantHt: Number(form.montantHt),
          montantFacture: Number(form.montantFacture),
          clientNom: form.clientNom,
          siteNom: form.siteNom,
          numeroClient: form.numeroClient?.trim() || null,
        };
      }
      if (slug === "facture") {
        return {
          numeroFacture: form.numeroFacture,
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
        await apiFetch(target, {
          token,
          method: "POST",
          body: JSON.stringify(postJsonBody()),
        });
        setOk("Enregistrement effectué.");
        notifyCountsRefresh();
        if (meta.listHref) {
          setTimeout(() => {
            router.push(meta.listHref as string);
            router.refresh();
          }, 500);
        }
      } catch (error) {
        setErr(error instanceof Error ? error.message : "Erreur lors de l'enregistrement.");
      } finally {
        setSaving(false);
      }
    })();
  }

  const hints = referenceHints();

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
                />
              ) : null}

              {slug === "client" ? (
                <>
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
                    <span className="crm-label">Téléphone</span>
                    <input className="crm-input" type="tel" value={form.telephone} onChange={(e) => setField("telephone", e.target.value)} placeholder="+33 …" />
                  </label>
                  <label className="crm-field crm-span-2">
                    <span className="crm-label">Email</span>
                    <input className="crm-input" type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} placeholder="contact@entreprise.fr" />
                  </label>
                  <label className="crm-field crm-span-2">
                    <span className="crm-label">
                      SIRET <span className="crm-opt">(optionnel)</span>
                    </span>
                    <input className="crm-input" value={form.siret} onChange={(e) => setField("siret", e.target.value)} placeholder="14 chiffres" inputMode="numeric" />
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
                </>
              ) : null}

              {slug === "site" ? (
                <>
                  <label className="crm-field">
                    <span className="crm-label">
                      Nom du site <span className="crm-req">*</span>
                    </span>
                    <input className="crm-input" value={form.nom} onChange={(e) => setField("nom", e.target.value)} placeholder="Libellé interne du site" />
                  </label>
                  <label className="crm-field">
                    <span className="crm-label">Type de site</span>
                    <input className="crm-input" value={form.typeSite} onChange={(e) => setField("typeSite", e.target.value)} placeholder="Bureaux, entrepôt, gare…" />
                  </label>
                  <label className="crm-field crm-span-2">
                    <span className="crm-label">Adresse</span>
                    <input className="crm-input" value={form.adresse ?? ""} onChange={(e) => setField("adresse", e.target.value)} placeholder="Voie, code postal, ville" autoComplete="street-address" />
                  </label>
                  <div className="crm-field crm-span-2">
                    <label htmlFor={`${fid}-site-client`} className="crm-label">
                      Client rattaché <span className="crm-req">*</span>
                    </label>
                    <select id={`${fid}-site-client`} className="crm-select" value={form.clientNom} onChange={(e) => setField("clientNom", e.target.value)}>
                      <option value="">Choisir un client…</option>
                      {clientsForSite.map((c) => (
                        <option key={c.id} value={c.raisonSociale}>
                          {c.raisonSociale}
                        </option>
                      ))}
                    </select>
                    {agenceScope !== "ALL" ? (
                      <p className="crm-hint">
                        Périmètre actif : {scopeDef(agenceScope).label} — seuls les clients de cette agence sont
                        proposés (le site apparaîtra dans la liste avec le même périmètre).
                      </p>
                    ) : null}
                  </div>
                </>
              ) : null}

              {slug === "offre" || slug === "commande" ? (
                <>
                  <div className="crm-field crm-span-2">
                    <label htmlFor={`${fid}-ref-num`} className="crm-label">
                      {slug === "offre" ? "Référence offre" : "Référence commande"}
                    </label>
                    <input
                      id={`${fid}-ref-num`}
                      className="crm-input"
                      value={slug === "offre" ? form.numeroOffre : form.numeroCommande}
                      onChange={(e) => setField(slug === "offre" ? "numeroOffre" : "numeroCommande", e.target.value)}
                      placeholder={slug === "offre" ? "ex. LVO-MOE-26009" : "ex. 2026-LVO-MOE-006"}
                    />
                    <p className="crm-hint">
                      {slug === "offre"
                        ? `${hints.offre} — le TYPE du n° doit être le type « principal » parmi les missions cochées (ordre LVO : A, ADC, MOE…).`
                        : `${hints.commande} — le préfixe TYPE doit être le type « principal » (ordre LVO : A, ADC, MOE…) parmi les missions cochées.`}
                    </p>
                  </div>
                  {slug === "commande" ? (
                    <label className="crm-field crm-span-2">
                      <span className="crm-label">N° bon / commande client</span>
                      <input className="crm-input" value={form.numeroClient ?? ""} onChange={(e) => setField("numeroClient", e.target.value)} placeholder="Référence chez le client (Phase 9)" />
                    </label>
                  ) : null}
                  <label className="crm-field">
                    <span className="crm-label">{slug === "offre" ? "Date de l’offre" : "Date de commande"}</span>
                    <input className="crm-input" type="date" value={slug === "offre" ? form.dateOffre : form.dateCommande} onChange={(e) => setField(slug === "offre" ? "dateOffre" : "dateCommande", e.target.value)} />
                  </label>
                  <div className="crm-field">
                    <label htmlFor={`${fid}-cmd-client`} className="crm-label">
                      Client <span className="crm-req">*</span>
                    </label>
                    <select id={`${fid}-cmd-client`} className="crm-select" value={form.clientNom} onChange={(e) => setField("clientNom", e.target.value)}>
                      {slug === "offre" ? (
                        <>
                          {(offreParties?.options ?? clients.map((c) => ({ clientNom: c.raisonSociale, label: c.raisonSociale }))).map((o) => (
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
                  {slug === "offre" ? (
                    <p className="crm-hint crm-span-2">
                      Client destinataire : propriétaire du site et/ou gestionnaires actifs — défaut : gestionnaire principal si défini.
                    </p>
                  ) : null}
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
                      {offreMissionsSelected.length > 1 ? (
                        <p className="crm-hint mt-1">
                          Type principal pour le n° d&apos;offre : <strong>{offrePrimaryMission}</strong>
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="crm-field crm-span-2">
                      <span className="crm-label">Types de mission (sélection multiple)</span>
                      <div className="crm-checkbox-grid mt-1">
                        {LVO_MISSION_TYPES.map((t) => (
                          <label key={t} className="crm-field-check">
                            <input
                              type="checkbox"
                              checked={!!commandeMissionPick[t]}
                              onChange={() => {
                                setCommandeMissionPick((prev) => {
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
                    </div>
                  )}
                  {slug === "offre" ? (
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
                  ) : (
                    <>
                      <label className="crm-field">
                        <span className="crm-label">Statut commande</span>
                        <select className="crm-select" value={form.statut ?? "EN_ATTENTE"} onChange={(e) => setField("statut", e.target.value)}>
                          {CRM_COMMANDE_STATUTS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="crm-field">
                        <span className="crm-label">
                          Montant facturé (€) <span className="crm-req">*</span>
                        </span>
                        <input className="crm-input" inputMode="decimal" value={form.montantFacture} onChange={(e) => setField("montantFacture", e.target.value)} placeholder="0,00" />
                      </label>
                    </>
                  )}
                  <label className="crm-field crm-span-2">
                    <span className="crm-label">
                      Montant HT (€) <span className="crm-req">*</span>
                    </span>
                    <input className="crm-input" inputMode="decimal" value={form.montantHt} onChange={(e) => setField("montantHt", e.target.value)} placeholder="0,00" />
                  </label>
                  {slug === "offre" ? (
                    <div className="crm-stack crm-span-2 space-y-3">
                      <p className="crm-stack-title">Phases d’offre (référentiel)</p>
                      <div className="crm-form-grid crm-form-grid--tight">
                        <div className="crm-field">
                          <label htmlFor={`${fid}-ph-mode`} className="crm-label">
                            Mode de sélection
                          </label>
                          <select
                            id={`${fid}-ph-mode`}
                            className="crm-select"
                            value={form.phasesMode}
                            onChange={(e) => {
                              const mode = e.target.value;
                              if (mode === "ALL") {
                                const pick: Record<string, boolean> = {};
                                let sum = 0;
                                for (const p of refPhases) {
                                  pick[p.code] = true;
                                  sum += p.prixIndicatifHt;
                                }
                                setPhasePick(pick);
                                setForm((prev) => ({ ...prev, phasesMode: mode, montantHt: String(sum) }));
                              } else {
                                setForm((prev) => ({ ...prev, phasesMode: mode }));
                              }
                            }}
                          >
                            <option value="ALL">Tout le référentiel</option>
                            <option value="SELECTION">Sélection</option>
                            <option value="CUSTOM">Personnalisé (lignes)</option>
                          </select>
                        </div>
                        <div className="crm-field">
                          <span className="crm-label">Consultant</span>
                          {consultants.length > 0 ? (
                            <select className="crm-select" value={form.consultantEmail} onChange={(e) => setField("consultantEmail", e.target.value)}>
                              {consultants.map((u) => (
                                <option key={u.id} value={u.email}>
                                  {u.email} ({u.role})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input className="crm-input" value={form.consultantEmail} onChange={(e) => setField("consultantEmail", e.target.value)} placeholder="email@lvo-ing.fr" />
                          )}
                        </div>
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
                              if (opt?.responsableContact) setField("gestionnaireContact", opt.responsableContact);
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
                          </p>
                        </div>
                        <label className="crm-field crm-span-2">
                          <span className="crm-label">Contact gestionnaire (personne)</span>
                          <input
                            className="crm-input"
                            value={form.gestionnaireContact ?? ""}
                            onChange={(e) => setField("gestionnaireContact", e.target.value)}
                            placeholder="Nom, email ou téléphone du référent"
                          />
                          <p className="crm-hint">Prérempli avec le responsable client si renseigné sur la fiche client.</p>
                        </label>
                        <label className="crm-field crm-span-2">
                          <span className="crm-label">Missions composant l&apos;offre (JSON)</span>
                          <textarea
                            className="crm-textarea crm-textarea--mono min-h-24"
                            value={form.missions}
                            onChange={(e) => setField("missions", e.target.value)}
                          />
                          <p className="crm-hint">Tableau : code, libelle, montantHt optionnel — plusieurs missions pour une même offre.</p>
                        </label>
                        <label className="crm-field crm-span-2">
                          <span className="crm-label">TVA (%)</span>
                          <input className="crm-input" value={form.tauxTva} onChange={(e) => setField("tauxTva", e.target.value)} type="number" step="0.1" min="0" />
                          <p className="crm-hint">Taux DOM 8,5 % appliqué automatiquement si le client est en Outre-mer.</p>
                        </label>
                      </div>
                      {form.phasesMode !== "CUSTOM" ? (
                        <ul className="max-h-44 space-y-2 overflow-y-auto rounded-lg border border-[var(--g200)] bg-white p-3 text-sm">
                          {refPhases.map((p) => (
                            <li key={p.code} className="flex items-start gap-2">
                              <input
                                type="checkbox"
                                className="mt-1 h-4 w-4 accent-[var(--orange)]"
                                disabled={form.phasesMode === "ALL"}
                                checked={!!phasePick[p.code]}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setPhasePick((prev) => ({ ...prev, [p.code]: checked }));
                                }}
                              />
                              <span>
                                <span className="font-mono text-xs text-neutral-500">{p.code}</span> {p.libelle}{" "}
                                <span className="text-neutral-500">({p.prixIndicatifHt} € HT indic.)</span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <label className="crm-field">
                          <span className="crm-label">Phases personnalisées</span>
                          <span className="crm-hint">Une ligne : CODE|Libellé|montant HT</span>
                          <textarea
                            className="crm-textarea crm-textarea--mono min-h-28"
                            value={form.customPhases}
                            onChange={(e) => setField("customPhases", e.target.value)}
                            placeholder={"MS-REG|Mission réglementaire|3200\nMS-VP|Visites|2100"}
                          />
                        </label>
                      )}
                      <label className="crm-field">
                        <span className="crm-label">Échéancier facturation (JSON)</span>
                        <textarea className="crm-textarea crm-textarea--mono min-h-20" value={form.echeancierFacturation} onChange={(e) => setField("echeancierFacturation", e.target.value)} />
                        <p className="crm-hint">
                          Ajoutez <code className="text-xs">moisFacturation</code> au format AAAA-MM pour le regroupement
                          mensuel (page Factures).
                        </p>
                      </label>
                      <div>
                        <PlanningExecutionEditor
                          value={form.echeancierExecution}
                          typeMission={offrePrimaryMission}
                          onChange={(json) => setField("echeancierExecution", json)}
                        />
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}

              {slug === "facture" ? (
                <>
                  <div className="crm-field crm-span-2">
                    <label htmlFor={`${fid}-fac-num`} className="crm-label">
                      Numéro de facture
                    </label>
                    <input id={`${fid}-fac-num`} className="crm-input" value={form.numeroFacture} onChange={(e) => setField("numeroFacture", e.target.value)} placeholder="ex. LVO-F2026-001" />
                    <p className="crm-hint">{hints.facture}</p>
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

          {slug === "contact" ? (
            <div className="crm-span-2">
              <CrmFormActions submitLabel={saving ? "Enregistrement…" : "Valider"} loading={saving} />
            </div>
          ) : (
            <div className="crm-span-2 mt-1 flex flex-col gap-3 border-t border-[var(--g200)] pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="crm-hint m-0">Les champs marqués d’une astérisque orange sont requis pour un dossier complet.</p>
              <button type="submit" className="cbtn cbtn-orange shrink-0" disabled={saving}>
                {saving ? "Enregistrement..." : "Valider"}
              </button>
            </div>
          )}
        </div>
      </form>
    </>
  );
}
