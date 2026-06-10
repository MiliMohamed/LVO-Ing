"use client";

import { useCallback, useEffect, useState } from "react";

import { CrmCreateButton } from "@/components/crm/CrmCreateButton";
import { CrmEntityModal } from "@/components/crm/ui/CrmEntityModal";
import { apiFetch } from "@/lib/api";
import { scoreQuontoMatch } from "@/lib/quonto-reconciliation";
import { recouvrementPaths } from "@/lib/recouvrement-api";
import type { FactureImpayeeRow, RecouvrementKpis, TransactionAttenteRow } from "@/lib/types";
import { readToken } from "@/lib/token-storage";

const money = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

function badgeRetard(jours: number): { label: string; className: string } {
  if (jours <= 0) return { label: `${jours} j`, className: "bg-emerald-100 text-emerald-900 border-emerald-300" };
  if (jours <= 15) return { label: `${jours} j`, className: "bg-amber-100 text-amber-900 border-amber-300" };
  if (jours <= 30) return { label: `${jours} j`, className: "bg-orange-100 text-orange-900 border-orange-300" };
  return { label: `${jours} j`, className: "bg-red-100 text-red-900 border-red-300" };
}

export function RecouvrementClient() {
  const token = readToken();
  const [kpis, setKpis] = useState<RecouvrementKpis | null>(null);
  const [factures, setFactures] = useState<FactureImpayeeRow[] | null>(null);
  const [transactions, setTransactions] = useState<TransactionAttenteRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [modal, setModal] = useState<{ tx: TransactionAttenteRow } | null>(null);
  const [modalFactureId, setModalFactureId] = useState<string>("");
  const [demoLibelle, setDemoLibelle] = useState("Virement LVO-F2026-001 ACME");
  const [demoScore, setDemoScore] = useState<number | null>(null);

  const reload = useCallback(async () => {
    setErr(null);
    try {
      const [k, f, t] = await Promise.all([
        apiFetch(recouvrementPaths.kpis, { token }) as Promise<RecouvrementKpis | null>,
        apiFetch(recouvrementPaths.facturesImpayees, { token }) as Promise<FactureImpayeeRow[] | null>,
        apiFetch(recouvrementPaths.transactionsEnAttente, { token }) as Promise<TransactionAttenteRow[] | null>,
      ]);
      setKpis(k);
      setFactures(Array.isArray(f) ? f : []);
      setTransactions(Array.isArray(t) ? t : []);
    } catch (e) {
      setKpis(null);
      setFactures([]);
      setTransactions([]);
      setErr(e instanceof Error ? e.message : "Erreur chargement recouvrement (endpoints API à brancher).");
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function postRelance(id: number) {
    setBusy(`relance-${id}`);
    setErr(null);
    try {
      await apiFetch(recouvrementPaths.relance(id), { token, method: "POST", body: JSON.stringify({ canal: "EMAIL" }) });
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur relance");
    } finally {
      setBusy(null);
    }
  }

  async function postPayerManuel(id: number) {
    const raw = globalThis.prompt("Montant TTC encaissé (nombre, ex. 1200.50)", "0");
    if (raw == null) return;
    const montant = Number(raw.replace(",", "."));
    if (!Number.isFinite(montant) || montant <= 0) {
      setErr("Montant invalide.");
      return;
    }
    setBusy(`pay-${id}`);
    setErr(null);
    try {
      await apiFetch(recouvrementPaths.payerManuel(id), {
        token,
        method: "POST",
        body: JSON.stringify({ montant, source: "MANUEL" }),
      });
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur paiement manuel");
    } finally {
      setBusy(null);
    }
  }

  async function postSyncQuonto() {
    setBusy("sync");
    setErr(null);
    try {
      await apiFetch(recouvrementPaths.syncQuonto, { token, method: "POST", body: "{}" });
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur synchro Quonto");
    } finally {
      setBusy(null);
    }
  }

  async function postRapprocher(txId: number | string, factureId: number) {
    setBusy(`rap-${txId}`);
    setErr(null);
    try {
      await apiFetch(recouvrementPaths.rapprocherTransaction(txId), {
        token,
        method: "POST",
        body: JSON.stringify({ factureId }),
      });
      setModal(null);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur rapprochement");
    } finally {
      setBusy(null);
    }
  }

  async function postIgnorer(txId: number | string) {
    if (!globalThis.confirm("Marquer cette transaction comme ignorée (commission, doublon, etc.) ?")) return;
    setBusy(`ig-${txId}`);
    setErr(null);
    try {
      await apiFetch(recouvrementPaths.ignorerTransaction(txId), { token, method: "POST", body: "{}" });
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur ignore");
    } finally {
      setBusy(null);
    }
  }

  function runDemoScore() {
    const f = factures?.[0];
    const t = transactions?.[0];
    if (!f || !t) {
      setDemoScore(null);
      return;
    }
    const s = scoreQuontoMatch({
      montantFactureTtc: f.montantTtc ?? f.montantHt * 1.2,
      montantTransaction: t.montant,
      libelle: demoLibelle || t.libelle,
      numeroFacture: f.numeroFacture,
      clientNom: f.clientNom,
      libelleContientIban: false,
      dateOperation: new Date(t.dateOperation),
      dateFacture: f.dateFacture ? new Date(f.dateFacture) : new Date(),
      dateEcheance: f.dateEcheance ? new Date(f.dateEcheance) : null,
    });
    setDemoScore(s);
  }

  return (
    <>
      <header className="pg-hdr mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1>Recouvrement</h1>
          <p>
            Impayés, relances et file Quonto (score 60–89). Backend attendu :{" "}
            <code className="rounded bg-neutral-100 px-1 text-xs">GET {recouvrementPaths.kpis}</code> et associés.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CrmCreateButton slug="facture" />
          <button type="button" className="cbtn cbtn-orange cbtn-sm" disabled={!!busy} onClick={() => void postSyncQuonto()}>
            {busy === "sync" ? "Synchro…" : "Sync Quonto maintenant"}
          </button>
          <button type="button" className="cbtn cbtn-ghost cbtn-sm" disabled={!!busy} onClick={() => void reload()}>
            Rafraîchir
          </button>
        </div>
      </header>

      {err ? <p className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{err}</p> : null}

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Total impayé HT" value={kpis ? money.format(kpis.totalImpayeHt) : "—"} />
        <KpiCard title="Factures en retard" value={kpis ? String(kpis.facturesEnRetard) : "—"} />
        <KpiCard title="DSO (jours)" value={kpis?.dsoJours != null ? `${kpis.dsoJours} j` : "—"} subtitle="Days Sales Outstanding" />
        <KpiCard
          title="Top clients en retard"
          value={
            kpis?.topClientsEnRetard?.length
              ? kpis.topClientsEnRetard
                  .slice(0, 5)
                  .map((c) => `${c.clientNom} (${money.format(c.montantHt)})`)
                  .join(" · ")
              : "—"
          }
          multiline
        />
      </section>

      <div className="mb-6 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-3 text-sm">
        <strong className="text-neutral-800">Scoring (spec plan)</strong> — aperçu local avec la 1ʳᵉ facture impayée et la 1ʳᵉ transaction en attente :{" "}
        <input
          className="ml-2 rounded border border-neutral-300 px-2 py-1 text-xs"
          value={demoLibelle}
          onChange={(e) => setDemoLibelle(e.target.value)}
          placeholder="Libellé banque"
        />
        <button type="button" className="cbtn cbtn-ghost cbtn-sm ml-2" onClick={runDemoScore}>
          Calculer score
        </button>
        {demoScore != null ? <span className="ml-2 font-mono text-neutral-700">{demoScore} / 100</span> : null}
      </div>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold text-neutral-800">Factures impayées</h2>
        <div className="tw overflow-x-auto">
          <table className="ct min-w-[720px]">
            <thead>
              <tr>
                <th>Référence</th>
                <th>Client</th>
                <th>Montant HT</th>
                <th>Émission / Échéance</th>
                <th>Retard</th>
                <th>Relance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {factures?.length ? (
                factures.map((row) => {
                  const b = badgeRetard(row.joursRetard);
                  return (
                    <tr key={row.id}>
                      <td className="font-mono text-sm">{row.numeroFacture}</td>
                      <td>{row.clientNom}</td>
                      <td>{money.format(row.montantHt)}</td>
                      <td className="text-xs text-neutral-600">
                        {row.dateFacture ?? "—"}
                        <br />
                        {row.dateEcheance ?? "—"}
                      </td>
                      <td>
                        <span className={`inline-block rounded border px-2 py-0.5 text-xs ${b.className}`}>{b.label}</span>
                      </td>
                      <td>{row.niveauRelance}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            className="cbtn cbtn-ghost cbtn-sm"
                            disabled={busy === `relance-${row.id}`}
                            onClick={() => void postRelance(row.id)}
                            title="Relance email"
                          >
                            📧 Relancer
                          </button>
                          <button
                            type="button"
                            className="cbtn cbtn-ghost cbtn-sm"
                            disabled={busy === `pay-${row.id}`}
                            onClick={() => void postPayerManuel(row.id)}
                          >
                            💰 Payé
                          </button>
                          <a className="cbtn cbtn-ghost cbtn-sm" href="/crm/factures">
                            🧾 Factures
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-sm text-neutral-500">
                    Aucune donnée — branche l’API sur <code>{recouvrementPaths.facturesImpayees}</code>.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-neutral-800">À rapprocher (Quonto, scores 60–89)</h2>
        <div className="tw overflow-x-auto">
          <table className="ct min-w-[640px]">
            <thead>
              <tr>
                <th>Libellé</th>
                <th>Montant</th>
                <th>Date</th>
                <th>Score</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions?.length ? (
                transactions.map((row) => (
                  <tr key={String(row.id)}>
                    <td className="max-w-xs truncate text-sm" title={row.libelle}>
                      {row.libelle}
                    </td>
                    <td>{money.format(row.montant)}</td>
                    <td className="text-xs">{row.dateOperation}</td>
                    <td>{row.score}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        <button type="button" className="cbtn cbtn-ghost cbtn-sm" onClick={() => setModal({ tx: row })}>
                          Rapprocher…
                        </button>
                        <button type="button" className="cbtn cbtn-ghost cbtn-sm" onClick={() => void postIgnorer(row.id)}>
                          Ignorer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-sm text-neutral-500">
                    Aucune transaction en file — <code>{recouvrementPaths.transactionsEnAttente}</code>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-8 text-xs text-neutral-500">
        Fallback CSV (plan §note) : même algorithme de scoring côté import — à exposer sur l’API (
        <code>POST /api/recouvrement/import-csv</code> suggéré). Webhook Quonto :{" "}
        <code>POST /api/webhooks/quonto</code> (HMAC, idempotence <code>quonto_transaction_id</code>).
      </p>

      {modal ? (
        <CrmEntityModal
          open
          onClose={() => setModal(null)}
          title="Rapprocher avec une facture"
          subtitle={modal.tx.libelle}
          size="md"
          footer={
            <>
              <button
                type="button"
                className="cbtn cbtn-orange cbtn-sm"
                disabled={!modalFactureId || !!busy}
                onClick={() => void postRapprocher(modal.tx.id, Number(modalFactureId))}
              >
                Valider
              </button>
              <button type="button" className="cbtn cbtn-ghost cbtn-sm" onClick={() => setModal(null)}>
                Annuler
              </button>
            </>
          }
        >
          <label className="crm-field">
            <span className="crm-label">Facture impayée</span>
            <select
              className="crm-select"
              value={modalFactureId}
              onChange={(e) => setModalFactureId(e.target.value)}
            >
              <option value="">— Choisir —</option>
              {(factures ?? []).map((f) => (
                <option key={f.id} value={String(f.id)}>
                  {f.numeroFacture} — {f.clientNom}
                </option>
              ))}
            </select>
          </label>
        </CrmEntityModal>
      ) : null}
    </>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  multiline,
}: {
  title: string;
  value: string;
  subtitle?: string;
  multiline?: boolean;
}) {
  return (
    <div className="fcard">
      <div className="fcard-body">
        <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{title}</div>
        <div className={`mt-1 text-neutral-900 ${multiline ? "text-sm leading-snug" : "text-xl font-semibold"}`}>{value}</div>
        {subtitle ? <div className="mt-1 text-xs text-neutral-400">{subtitle}</div> : null}
      </div>
    </div>
  );
}
