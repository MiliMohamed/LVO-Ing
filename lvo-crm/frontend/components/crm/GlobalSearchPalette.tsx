"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { getCrmHomeHref, normalizeRole } from "@/lib/rbac";
import { readRole, readToken } from "@/lib/token-storage";

type Hit = { kind: string; id: number; label: string; sub: string };

type SearchResponse = {
  offres: Hit[];
  commandes: Hit[];
  clients: Hit[];
  contacts: Hit[];
  sites: Hit[];
};

const KIND_ICON: Record<string, string> = {
  offre: "pi pi-file-edit",
  commande: "pi pi-shopping-cart",
  client: "pi pi-building",
  contact: "pi pi-user",
  site: "pi pi-map-marker",
};

function hrefFor(h: Hit): string {
  switch (h.kind) {
    case "offre":
      return "/crm/offres";
    case "commande":
      return "/crm/commandes";
    case "client":
      return "/crm/clients";
    case "contact":
      return "/crm/contacts";
    case "site":
      return "/crm/sites";
    default:
      return getCrmHomeHref(normalizeRole(readRole()));
  }
}

function shortcutLabel(): string {
  if (typeof navigator === "undefined") return "Ctrl+K";
  return /Mac|iPhone|iPad/i.test(navigator.platform) ? "⌘K" : "Ctrl+K";
}

export function GlobalSearchPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [modKey, setModKey] = useState("Ctrl+K");

  useEffect(() => {
    setModKey(shortcutLabel());
  }, []);

  const runSearch = useCallback(async (query: string) => {
    const token = readToken();
    if (!query.trim()) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const res = (await apiFetch("/api/search", {
        token,
        method: "POST",
        body: JSON.stringify({ q: query.trim() }),
      })) as SearchResponse | null;
      setData(res);
    } catch {
      setData({ offres: [], commandes: [], clients: [], contacts: [], sites: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => void runSearch(q), 220);
    return () => window.clearTimeout(t);
  }, [open, q, runSearch]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function closePalette() {
    setOpen(false);
  }

  const sections: { title: string; items: Hit[] }[] = data
    ? [
        { title: "Offres", items: data.offres },
        { title: "Commandes", items: data.commandes },
        { title: "Clients", items: data.clients },
        { title: "Contacts", items: data.contacts },
        { title: "Sites", items: data.sites },
      ]
    : [];

  const totalHits = sections.reduce((n, s) => n + s.items.length, 0);
  const hasQuery = q.trim().length > 0;

  return (
    <>
      <button
        type="button"
        className="ctb-search"
        onClick={() => setOpen(true)}
        title={`Recherche globale (${modKey})`}
        aria-label="Ouvrir la recherche globale"
      >
        <span className="ctb-search__icon pi pi-search" aria-hidden />
        <span className="ctb-search__label">Rechercher…</span>
        <kbd className="ctb-search__kbd">{modKey}</kbd>
      </button>

      {open ? (
        <div
          className="crm-search-palette-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Recherche globale CRM"
          onMouseDown={closePalette}
        >
          <div className="crm-search-palette fcard" onMouseDown={(e) => e.stopPropagation()}>
            <div className="fcard-hdr crm-search-palette__hdr">
              <div className="min-w-0 flex-1">
                <h2>Recherche globale</h2>
                <div className="fcard-hdr-sub">Offres, commandes, clients, contacts, sites</div>
              </div>
              <button type="button" className="cbtn cbtn-ghost cbtn-sm" onClick={closePalette}>
                Fermer
              </button>
            </div>

            <div className="crm-search-palette__input-wrap">
              <span className="crm-search-palette__input-icon pi pi-search" aria-hidden />
              <input
                autoFocus
                type="search"
                className="crm-toolbar-input crm-toolbar-input--search crm-search-palette__input"
                placeholder="Tapez un numéro, un nom, un client…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Terme de recherche"
              />
              {hasQuery ? (
                <button
                  type="button"
                  className="crm-search-palette__clear"
                  onClick={() => setQ("")}
                  aria-label="Effacer la recherche"
                >
                  <span className="pi pi-times" aria-hidden />
                </button>
              ) : null}
            </div>

            <div className="crm-search-palette__results">
              {loading ? (
                <p className="crm-search-palette__empty">
                  <span className="pi pi-spin pi-spinner mr-2" aria-hidden />
                  Recherche en cours…
                </p>
              ) : null}

              {!loading && hasQuery && data && totalHits > 0
                ? sections.map((sec) =>
                    sec.items.length ? (
                      <div key={sec.title} className="crm-search-palette__section">
                        <div className="crm-search-palette__section-title">{sec.title}</div>
                        <ul className="crm-search-palette__list">
                          {sec.items.map((h) => (
                            <li key={`${h.kind}-${h.id}`}>
                              <Link
                                href={hrefFor(h)}
                                className="crm-search-palette__hit"
                                onClick={closePalette}
                              >
                                <span
                                  className={`crm-search-palette__hit-icon ${KIND_ICON[h.kind] ?? "pi pi-circle"}`}
                                  aria-hidden
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="crm-search-palette__hit-label">{h.label}</span>
                                  {h.sub ? (
                                    <span className="crm-search-palette__hit-sub">{h.sub}</span>
                                  ) : null}
                                </span>
                                <span className="crm-search-palette__hit-go pi pi-arrow-right" aria-hidden />
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null,
                  )
                : null}

              {!loading && hasQuery && data && totalHits === 0 ? (
                <p className="crm-search-palette__empty">Aucun résultat pour « {q.trim()} ».</p>
              ) : null}

              {!hasQuery ? (
                <div className="crm-search-palette__hints">
                  <p className="crm-search-palette__empty">Saisissez un terme pour lancer la recherche.</p>
                  <ul className="crm-search-palette__tips">
                    <li>Numéro d&apos;offre ou de commande</li>
                    <li>Raison sociale client</li>
                    <li>Nom de contact ou de site</li>
                  </ul>
                </div>
              ) : null}
            </div>

            <div className="crm-search-palette__footer">
              <span>
                <kbd className="crm-search-palette__kbd">{modKey}</kbd> ouvrir / fermer
              </span>
              <span>
                <kbd className="crm-search-palette__kbd">Esc</kbd> fermer
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
