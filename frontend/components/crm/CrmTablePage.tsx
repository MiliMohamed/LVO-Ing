"use client";

import { useEffect, useMemo, useState } from "react";

import { CancelCommandeModal } from "@/components/crm/CancelCommandeModal";
import { CrmPageHeader, CrmListFilters } from "@/components/crm/ui";
import type { CrmCreateSlug } from "@/lib/crm-create";
import { CrmEntityEditModal, type CrmEntityEditPath } from "@/components/crm/CrmEntityEditModal";
import { Phase5EntitySheet, type Phase5EntityKind } from "@/components/crm/Phase5EntitySheet";
import { useCrmToast } from "@/components/crm/CrmToast";
import { apiFetch } from "@/lib/api";
import {
  onAgenceScopeChange,
  readAgenceScope,
  rowMatchesAgenceScope,
  scopeDef,
  type AgenceScopeId,
} from "@/lib/agence-scope";
import { notifyCountsRefresh } from "@/lib/dashboard-counts";
import { canMutate, normalizeRole } from "@/lib/rbac";
import { readRole, readToken } from "@/lib/token-storage";
import type { CommandeRow } from "@/lib/types";

const moneyFr = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export type ColumnKey<T> = {
  key: keyof T | string;
  label: string;
  /** Formats côté client (évite de passer des fonctions depuis les Server Components) */
  preset?: "moneyFr";
};

function formatCell<T extends object>(row: T, col: ColumnKey<T>): string {
  const raw = row[col.key as keyof T];
  if (raw == null) return "—";
  if (col.preset === "moneyFr") {
    const n = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(n) ? moneyFr.format(n) : String(raw);
  }
  if (typeof raw === "object") return JSON.stringify(raw);
  return String(raw);
}

export function CrmTablePage<T extends object>({
  title,
  subtitle,
  path,
  columns,
  enableCrud = false,
  phase4CancelCommandes = false,
  phase5EntityMode,
  phase6SiteGestionnaireFilter = false,
  createSlug,
}: {
  title: string;
  subtitle: string;
  path: string;
  columns: ColumnKey<T>[];
  /** Bouton « Nouveau … » en tête de page */
  createSlug?: CrmCreateSlug;
  enableCrud?: boolean;
  /** Annulation commande : modal factures / avoirs (Phase 4) */
  phase4CancelCommandes?: boolean;
  /** Fiche métier + PATCH/DELETE contrôlés (Phase 5) */
  phase5EntityMode?: Phase5EntityKind;
  /** Liste sites : filtre par gestionnaire actif (Phase 6 / R3) */
  phase6SiteGestionnaireFilter?: boolean;
}) {
  const [rows, setRows] = useState<T[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [gestionnaireFilter, setGestionnaireFilter] = useState("");
  const [gestionnaireOptions, setGestionnaireOptions] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [agenceScope, setAgenceScope] = useState<AgenceScopeId>("ALL");
  const [clientNomsScope, setClientNomsScope] = useState<Set<string> | null>(null);
  const toast = useCrmToast();
  const bumpList = (message?: string) => {
    setReloadTick((v) => v + 1);
    notifyCountsRefresh();
    if (message) toast.success(message);
  };

  useEffect(() => {
    setAgenceScope(readAgenceScope());
    return onAgenceScopeChange(() => setAgenceScope(readAgenceScope()));
  }, []);

  useEffect(() => {
    if (agenceScope === "ALL" || (path !== "/api/offres" && path !== "/api/sites")) {
      setClientNomsScope(null);
      return;
    }
    const token = readToken();
    let cancel = false;
    void (async () => {
      try {
        const clients = (await apiFetch("/api/clients", { token })) as Record<string, unknown>[] | null;
        if (cancel) return;
        const noms = new Set<string>();
        for (const c of Array.isArray(clients) ? clients : []) {
          if (rowMatchesAgenceScope(c, agenceScope) && c.raisonSociale) noms.add(String(c.raisonSociale));
        }
        setClientNomsScope(noms);
      } catch {
        if (!cancel) setClientNomsScope(null);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [agenceScope, path, reloadTick]);
  const [cancelCmd, setCancelCmd] = useState<CommandeRow | null>(null);
  const [sheetRow, setSheetRow] = useState<Record<string, unknown> | null>(null);
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const crudEnabled = enableCrud && canMutate(normalizeRole(readRole()));
  const phase5 = Boolean(phase5EntityMode);

  const structuredEditPath: CrmEntityEditPath | null =
    path === "/api/offres" || path === "/api/commandes" ? path : null;

  useEffect(() => {
    const token = readToken();
    let cancelled = false;
    void (async () => {
      try {
        const d = (await apiFetch(path, { token })) as T[] | null;
        if (!cancelled) {
          setRows(Array.isArray(d) ? d : []);
          setErr(null);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Erreur");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path, reloadTick]);

  useEffect(() => {
    if (!phase6SiteGestionnaireFilter || path !== "/api/sites") return;
    const token = readToken();
    let cancelled = false;
    void (async () => {
      try {
        const d = (await apiFetch("/api/sites/meta/gestionnaires-filters", { token })) as { noms?: string[] } | null;
        if (!cancelled) setGestionnaireOptions(Array.isArray(d?.noms) ? d.noms : []);
      } catch {
        if (!cancelled) setGestionnaireOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path, phase6SiteGestionnaireFilter, reloadTick]);

  const qFiltered = useMemo(() => {
    if (!rows) return [];
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(s));
  }, [rows, q]);

  const filtered = useMemo(() => {
    let list = qFiltered;
    if (agenceScope !== "ALL") {
      if (path === "/api/clients" || path === "/api/contacts") {
        list = list.filter((row) => rowMatchesAgenceScope(row as Record<string, unknown>, agenceScope));
      } else if ((path === "/api/offres" || path === "/api/sites") && clientNomsScope && clientNomsScope.size > 0) {
        list = list.filter((row) => clientNomsScope.has(String((row as { clientNom?: string }).clientNom ?? "")));
      }
    }
    if (!phase6SiteGestionnaireFilter || path !== "/api/sites" || !gestionnaireFilter) return list;
    return list.filter((row) => {
      const act = (row as unknown as { gestionnairesActifs?: string[] }).gestionnairesActifs ?? [];
      return act.includes(gestionnaireFilter);
    });
  }, [qFiltered, gestionnaireFilter, path, phase6SiteGestionnaireFilter, agenceScope, clientNomsScope]);

  const hiddenByFilters = qFiltered.length - filtered.length;

  const sheetEffective = useMemo(() => {
    if (!sheetRow) return null;
    if (!rows) return sheetRow;
    const id = Number(sheetRow.id);
    const found = (rows as unknown as Record<string, unknown>[]).find((r) => Number(r.id) === id);
    return found ?? sheetRow;
  }, [sheetRow, rows]);

  return (
    <>
      <CrmPageHeader title={title} subtitle={subtitle} createSlug={createSlug} />
      {err ? <p className="crm-alert crm-alert--error mb-3">{err}</p> : null}

      <CrmListFilters
        searchValue={q}
        onSearchChange={setQ}
        searchPlaceholder="Rechercher dans la liste…"
        filteredCount={filtered.length}
        totalCount={rows?.length ?? null}
        hasExtraFilters={Boolean(gestionnaireFilter) || agenceScope !== "ALL"}
        onClear={() => {
          setGestionnaireFilter("");
          setQ("");
        }}
      >
        {phase6SiteGestionnaireFilter && path === "/api/sites" ? (
          <div className="crm-list-filters__group">
            <span className="crm-list-filters__label">Gestionnaire</span>
            <select
              className="crm-toolbar-select"
              value={gestionnaireFilter}
              onChange={(e) => setGestionnaireFilter(e.target.value)}
              aria-label="Filtrer par gestionnaire"
            >
              <option value="">Tous gestionnaires</option>
              {gestionnaireOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </CrmListFilters>

      {path === "/api/sites" && hiddenByFilters > 0 ? (
        <p className="crm-alert crm-alert--warn mb-3">
          {hiddenByFilters} site(s) masqué(s) par les filtres actifs
          {agenceScope !== "ALL" ? ` (périmètre : ${scopeDef(agenceScope).label})` : ""}
          {gestionnaireFilter ? ` (gestionnaire : ${gestionnaireFilter})` : ""}. Passez le périmètre sur « Toutes
          agences » ou cliquez « Effacer les filtres ».
        </p>
      ) : null}

      <div className="tw">
        <table className="ct">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={String(c.key)}>{c.label}</th>
              ))}
              {enableCrud ? <th>Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr key={i}>
                {columns.map((c) => (
                  <td key={String(c.key)}>{formatCell(row, c)}</td>
                ))}
                {crudEnabled ? (
                  <td>
                    <div className="flex flex-wrap gap-2">
                      {phase5 ? (
                        <button
                          type="button"
                          className="cbtn cbtn-ghost cbtn-sm"
                          onClick={() => setSheetRow({ ...(row as Record<string, unknown>) })}
                        >
                          Fiche
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="cbtn cbtn-ghost cbtn-sm"
                            disabled={busyId === Number((row as Record<string, unknown>).id)}
                            onClick={async () => {
                              const id = Number((row as Record<string, unknown>).id);
                              if (!Number.isFinite(id)) return;
                              if (structuredEditPath) {
                                setEditRow({ ...(row as Record<string, unknown>) });
                                return;
                              }
                              const next = globalThis.prompt(
                                "Modifier la ligne en JSON puis valider",
                                JSON.stringify(row, null, 2),
                              );
                              if (!next) return;
                              try {
                                const payload = JSON.parse(next) as Record<string, unknown>;
                                delete payload.id;
                                setBusyId(id);
                                await apiFetch(`${path}/${id}`, {
                                  token: readToken(),
                                  method: "PUT",
                                  body: JSON.stringify(payload),
                                });
                                bumpList("Enregistrement mis à jour");
                              } catch (e) {
                                setErr(e instanceof Error ? e.message : "Erreur de mise à jour");
                              } finally {
                                setBusyId(null);
                              }
                            }}
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            className="cbtn cbtn-ghost cbtn-sm"
                            disabled={busyId === Number((row as Record<string, unknown>).id)}
                            onClick={async () => {
                              const id = Number((row as Record<string, unknown>).id);
                              if (!Number.isFinite(id)) return;
                              if (!globalThis.confirm("Confirmer la suppression ?")) return;
                              try {
                                setBusyId(id);
                                await apiFetch(`${path}/${id}`, {
                                  token: readToken(),
                                  method: "DELETE",
                                });
                                bumpList("Enregistrement mis à jour");
                              } catch (e) {
                                setErr(e instanceof Error ? e.message : "Erreur de suppression");
                              } finally {
                                setBusyId(null);
                              }
                            }}
                          >
                            Supprimer
                          </button>
                        </>
                      )}
                      {(path === "/api/offres" || path === "/api/commandes") ? (
                        <>
                          {path === "/api/offres" ? (
                            <button
                              type="button"
                              className="cbtn cbtn-ghost cbtn-sm"
                              onClick={async () => {
                                const id = Number((row as Record<string, unknown>).id);
                                if (!Number.isFinite(id)) return;
                                try {
                                  setBusyId(id);
                                  await apiFetch(`${path}/${id}/duplicate`, {
                                    token: readToken(),
                                    method: "POST",
                                  });
                                  bumpList("Enregistrement mis à jour");
                                } catch (e) {
                                  setErr(e instanceof Error ? e.message : "Erreur de duplication");
                                } finally {
                                  setBusyId(null);
                                }
                              }}
                            >
                              Dupliquer
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="cbtn cbtn-ghost cbtn-sm"
                            onClick={async () => {
                              const id = Number((row as Record<string, unknown>).id);
                              if (!Number.isFinite(id)) return;
                              if (path === "/api/commandes" && phase4CancelCommandes) {
                                setCancelCmd(row as unknown as CommandeRow);
                                return;
                              }
                              const motif = globalThis.prompt("Motif d'annulation", "Projet abandonné");
                              if (!motif) return;
                              try {
                                setBusyId(id);
                                await apiFetch(`${path}/${id}/cancel`, {
                                  token: readToken(),
                                  method: "POST",
                                  body: JSON.stringify({ motif }),
                                });
                                bumpList("Enregistrement mis à jour");
                              } catch (e) {
                                setErr(e instanceof Error ? e.message : "Erreur d'annulation");
                              } finally {
                                setBusyId(null);
                              }
                            }}
                          >
                            Annuler
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cancelCmd ? (
        <CancelCommandeModal
          commande={cancelCmd}
          onClose={() => setCancelCmd(null)}
          onDone={bumpList}
        />
      ) : null}
      {sheetRow && phase5EntityMode && sheetEffective ? (
        <Phase5EntitySheet
          open
          kind={phase5EntityMode}
          path={path}
          row={sheetEffective}
          onClose={() => setSheetRow(null)}
          onSaved={bumpList}
        />
      ) : null}
      {editRow && structuredEditPath ? (
        <CrmEntityEditModal
          path={structuredEditPath}
          row={editRow}
          onClose={() => setEditRow(null)}
          onSaved={bumpList}
        />
      ) : null}
    </>
  );
}
