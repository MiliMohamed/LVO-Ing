"use client";

import { useEffect, useMemo, useState } from "react";

import { CrmCreateButton } from "@/components/crm/CrmCreateButton";
import { CrmEntityEditModal } from "@/components/crm/CrmEntityEditModal";
import { CrmEntityModal } from "@/components/crm/ui/CrmEntityModal";
import { CrmListFilters } from "@/components/crm/ui/CrmListFilters";
import { apiFetch } from "@/lib/api";
import { notifyCountsRefresh } from "@/lib/dashboard-counts";
import { canDeleteFactureMetier, canMutate, normalizeRole } from "@/lib/rbac";
import { readRole, readToken } from "@/lib/token-storage";
import type { EcheanceFacturationMoisRow, FactureRow } from "@/lib/types";

const money = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

function labelStatut(s: string | undefined) {
  switch ((s || "").toUpperCase()) {
    case "CREEE":
      return "Créée";
    case "ENVOYEE":
      return "Envoyée";
    case "ANNULEE":
      return "Annulée";
    case "PAYEE":
      return "Payée";
    default:
      return s || "—";
  }
}

function formatMoisFr(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

type EcheancesResponse = {
  mois?: string[];
  lignes?: EcheanceFacturationMoisRow[];
};

export function FacturesPageClient() {
  const [rows, setRows] = useState<FactureRow[] | null>(null);
  const [ech, setEch] = useState<EcheancesResponse | null>(null);
  const [selectedYm, setSelectedYm] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const bumpList = () => {
    setReloadTick((v) => v + 1);
    notifyCountsRefresh();
  };
  const [busyId, setBusyId] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [delTarget, setDelTarget] = useState<FactureRow | null>(null);
  const [delMotif, setDelMotif] = useState("");
  const [delAvoir, setDelAvoir] = useState(false);
  const [sendTarget, setSendTarget] = useState<FactureRow | null>(null);
  const [editRow, setEditRow] = useState<FactureRow | null>(null);

  const crud = canMutate(normalizeRole(readRole()));
  const canDelMetier = canDeleteFactureMetier(normalizeRole(readRole()));

  useEffect(() => {
    const token = readToken();
    let cancelled = false;
    void (async () => {
      try {
        const [f, e] = await Promise.all([
          apiFetch("/api/factures", { token }) as Promise<FactureRow[]>,
          apiFetch("/api/facturation/echeances-par-mois", { token }) as Promise<EcheancesResponse>,
        ]);
        if (cancelled) return;
        setRows(Array.isArray(f) ? f : []);
        setEch(e && typeof e === "object" ? e : { mois: [], lignes: [] });
        setErr(null);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Erreur");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  useEffect(() => {
    const mois = ech?.mois ?? [];
    if (mois.length && !selectedYm) setSelectedYm(mois[0]!);
  }, [ech, selectedYm]);

  const lignesMois = useMemo(() => {
    const all = ech?.lignes ?? [];
    if (!selectedYm) return [];
    return all.filter((l) => l.moisFacturation === selectedYm);
  }, [ech, selectedYm]);

  const totalMoisHt = useMemo(() => lignesMois.reduce((s, l) => s + l.montantHtEstime, 0), [lignesMois]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(s));
  }, [rows, q]);

  async function envoyer(f: FactureRow) {
    const token = readToken();
    setBusyId(f.id);
    try {
      await apiFetch(`/api/factures/${f.id}/envoyer`, { token, method: "POST", body: "{}" });
      bumpList();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur envoi");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmerEnvoi() {
    if (!sendTarget) return;
    await envoyer(sendTarget);
    setSendTarget(null);
  }

  async function confirmerSuppression() {
    if (!delTarget || !delMotif.trim()) return;
    const token = readToken();
    setBusyId(delTarget.id);
    try {
      await apiFetch(`/api/factures/${delTarget.id}/supprimer`, {
        token,
        method: "POST",
        body: JSON.stringify({ motif: delMotif.trim(), creerAvoir: delAvoir }),
      });
      setDelTarget(null);
      setDelMotif("");
      setDelAvoir(false);
      bumpList();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur suppression");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <header className="pg-hdr mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1>Factures</h1>
          <p>
            Statuts métier (créée → envoyée → payée), envoi après confirmation (facture « Créée »), suppression tracée avec
            option avoir. Regroupement des jalons à facturer par mois (champ{" "}
            <code className="text-xs">moisFacturation</code> dans l&apos;échéancier JSON de l&apos;offre).
          </p>
        </div>
        <CrmCreateButton slug="facture" />
      </header>

      {err ? <p className="crm-alert crm-alert--error mb-3">{err}</p> : null}

      <section className="fcard mb-6">
        <div className="fcard-hdr">
          <h2>À facturer par mois</h2>
          <div className="fcard-hdr-sub">Jalons issus des échéanciers offres / commandes</div>
        </div>
        <div className="fcard-body">
        <p className="crm-hint mb-3">
          Cliquez sur un mois pour afficher les lignes issues des offres (échéancier facturation + commande associée).
          Créez ensuite une facture depuis <strong>Nouveau → Facture</strong> en reprenant le total affiché si vous
          regroupez plusieurs jalons sur une même commande.
        </p>
        <div className="crm-filter-chips mb-3">
          {(ech?.mois ?? []).map((ym) => (
            <button
              key={ym}
              type="button"
              className={`cbtn cbtn-sm ${selectedYm === ym ? "cbtn-primary" : "cbtn-ghost"}`}
              onClick={() => setSelectedYm(ym)}
            >
              {formatMoisFr(ym)}
            </button>
          ))}
        </div>
        {selectedYm ? (
          <>
            <p className="mb-2 text-xs text-neutral-600">
              Total estimé pour <strong>{formatMoisFr(selectedYm)}</strong> :{" "}
              <strong>{money.format(totalMoisHt)}</strong> HT ({lignesMois.length} ligne(s))
            </p>
            <div className="tw overflow-x-auto">
              <table className="ct text-sm">
                <thead>
                  <tr>
                    <th>Offre</th>
                    <th>Client</th>
                    <th>Commande</th>
                    <th>Jalon</th>
                    <th>%</th>
                    <th>Montant HT est.</th>
                  </tr>
                </thead>
                <tbody>
                  {lignesMois.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-neutral-500">
                        Aucune ligne pour ce mois.
                      </td>
                    </tr>
                  ) : (
                    lignesMois.map((l, i) => (
                      <tr key={`${l.offreId}-${l.libelle}-${i}`}>
                        <td className="font-mono text-xs">{l.numeroOffre}</td>
                        <td>{l.clientNom}</td>
                        <td className="font-mono text-xs">{l.numeroCommande}</td>
                        <td>{l.libelle}</td>
                        <td>{l.pourcentage}%</td>
                        <td>{money.format(l.montantHtEstime)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="crm-hint">Chargement des mois…</p>
        )}
        </div>
      </section>

      <CrmListFilters
        searchValue={q}
        onSearchChange={setQ}
        searchPlaceholder="Rechercher une facture…"
        searchAriaLabel="Filtrer les factures"
        filteredCount={filtered.length}
        totalCount={rows?.length ?? null}
        countUnit="facture(s)"
      />

      <div className="tw">
        <table className="ct">
          <thead>
            <tr>
              <th>N° facture</th>
              <th>N° commande</th>
              <th>Date</th>
              <th>Client</th>
              <th>Montant HT</th>
              <th>Frais</th>
              <th>Règlement</th>
              <th>Statut métier</th>
              {crud ? <th>Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id}>
                <td>{row.numeroFacture}</td>
                <td>{row.numeroCommande}</td>
                <td>{row.dateFacture ?? "—"}</td>
                <td>{row.clientNom}</td>
                <td>{money.format(row.montantHt)}</td>
                <td>{money.format(row.frais)}</td>
                <td>{row.modeReglement}</td>
                <td>{labelStatut(row.statutFacturation)}</td>
                {crud ? (
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="cbtn cbtn-ghost cbtn-sm"
                        disabled={busyId === row.id}
                        onClick={() => setEditRow(row)}
                      >
                        Modifier
                      </button>
                      {(row.statutFacturation ?? "ENVOYEE") === "CREEE" ? (
                        <button
                          type="button"
                          className="cbtn cbtn-ghost cbtn-sm"
                          disabled={busyId === row.id}
                          onClick={() => setSendTarget(row)}
                        >
                          Envoyer…
                        </button>
                      ) : null}
                      {canDelMetier ? (
                        <button
                          type="button"
                          className="cbtn cbtn-ghost cbtn-sm"
                          disabled={busyId === row.id}
                          onClick={() => {
                            setDelTarget(row);
                            setDelMotif("");
                            setDelAvoir(false);
                          }}
                        >
                          Supprimer…
                        </button>
                      ) : null}
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sendTarget ? (
        <CrmEntityModal
          open
          onClose={() => setSendTarget(null)}
          title={`Envoyer la facture ${sendTarget.numeroFacture}`}
          subtitle={`Client : ${sendTarget.clientNom}`}
          size="md"
          footer={
            <>
              <button
                type="button"
                className="cbtn cbtn-primary"
                disabled={busyId === sendTarget.id}
                onClick={() => void confirmerEnvoi()}
              >
                Confirmer l&apos;envoi
              </button>
              <button type="button" className="cbtn cbtn-ghost" onClick={() => setSendTarget(null)}>
                Annuler
              </button>
            </>
          }
        >
          <p className="crm-hint">
            Confirmer le passage au statut <strong>Envoyée</strong> (envoi e-mail / PDF à connecter côté intégration).
            Montant HT <strong>{money.format(sendTarget.montantHt)}</strong>, frais{" "}
            <strong>{money.format(sendTarget.frais)}</strong>.
          </p>
        </CrmEntityModal>
      ) : null}

      {delTarget ? (
        <CrmEntityModal
          open
          onClose={() => setDelTarget(null)}
          title={`Supprimer la facture ${delTarget.numeroFacture}`}
          subtitle="Annulation enregistrée dans l'historique métier"
          size="md"
          footer={
            <>
              <button
                type="button"
                className="cbtn cbtn-danger"
                disabled={!delMotif.trim() || busyId === delTarget.id}
                onClick={() => void confirmerSuppression()}
              >
                Confirmer
              </button>
              <button type="button" className="cbtn cbtn-ghost" onClick={() => setDelTarget(null)}>
                Annuler
              </button>
            </>
          }
        >
          <p className="crm-hint mb-3">
            La suppression est enregistrée dans l&apos;historique des annulations (type FACTURE). Vous pouvez émettre
            un avoir sur le montant TTC.
          </p>
          <div className="crm-form-grid crm-form-grid--tight">
            <label className="crm-field crm-span-2">
              <span className="crm-label">
                Motif <span className="crm-req">*</span>
              </span>
              <input
                className="crm-input"
                value={delMotif}
                onChange={(e) => setDelMotif(e.target.value)}
                placeholder="Ex. doublon, montant erroné…"
              />
            </label>
            <label className="crm-field-check crm-span-2">
              <input type="checkbox" checked={delAvoir} onChange={(e) => setDelAvoir(e.target.checked)} />
              Créer un avoir (montant HT + frais, TVA selon client)
            </label>
          </div>
        </CrmEntityModal>
      ) : null}

      {editRow ? (
        <CrmEntityEditModal
          path="/api/factures"
          row={editRow as unknown as Record<string, unknown>}
          onClose={() => setEditRow(null)}
          onSaved={() => {
            setEditRow(null);
            bumpList();
          }}
        />
      ) : null}
    </>
  );
}
