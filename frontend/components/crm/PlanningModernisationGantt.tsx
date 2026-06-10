"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { LVO_LOGO_ALT, LVO_LOGO_SRC } from "@/lib/branding";
import {
  addWeeksMonday,
  buildGenericTemplateBars,
  defaultGenericLots,
  defaultPlanningDoc,
  isoWithYearMonth,
  lotCouleur,
  lotLibelle,
  mondayOfIsoWeek,
  monthNameSpansFromWeeks,
  parsePlanningDoc,
  planningDocStorageKey,
  readPlanningProjectList,
  sortedBars,
  STORAGE_KEY_PLANNING_GANTT,
  stringifyPlanningDoc,
  upsertPlanningProjectMeta,
  weekRange,
  yearSpansFromWeeks,
  PLANNING_LAST_PROJECT_KEY,
  type GanttBar,
  type PlanningGanttDoc,
  type PlanningLot,
} from "@/lib/planning-modernisation-gantt";

const WEEK_W = 26;
const ROW_H = 32;
const LANE_COL_W = 100;
const TASK_COL_W = 260;
const LEFT_GUTTER = LANE_COL_W + TASK_COL_W;

const MOIS_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  mois: i + 1,
  label: new Date(2000, i, 1).toLocaleDateString("fr-FR", { month: "long" }),
}));
const ANNEE_OPTIONS = Array.from({ length: 50 }, (_, i) => 2000 + i);

type DragState = { barId: string; originX: number; originDebut: number };

type Props = {
  initialJson?: string | null;
};

function parseYmd(iso: string): { y: number; m: number } {
  const p = iso.split("-").map((x) => Number(x));
  const y = Number.isFinite(p[0]) ? p[0]! : new Date().getFullYear();
  const m = Number.isFinite(p[1]) ? Math.min(12, Math.max(1, p[1]!)) : 1;
  return { y, m };
}

function safeExportBasename(nom: string): string {
  const s = nom
    .trim()
    .replace(/[^a-zA-Z0-9À-ÿ\-_.]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 48);
  return s || "planning";
}

export function PlanningModernisationGantt({ initialJson }: Props) {
  const bootstrapped = useRef(false);
  const [doc, setDoc] = useState<PlanningGanttDoc>(() => (initialJson ? parsePlanningDoc(initialJson) : defaultPlanningDoc()));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [storageReady, setStorageReady] = useState(!!initialJson);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    if (initialJson) {
      setDoc(parsePlanningDoc(initialJson));
      setStorageReady(true);
      return;
    }
    try {
      let list = readPlanningProjectList();
      const legacy = localStorage.getItem(STORAGE_KEY_PLANNING_GANTT);
      if (legacy?.trim() && list.length === 0) {
        const migrated = parsePlanningDoc(legacy);
        migrated.projetId = "proj-migrated-default";
        migrated.projetNom = migrated.projetNom?.trim() || migrated.titre.slice(0, 80) || "Planning importé";
        localStorage.setItem(planningDocStorageKey(migrated.projetId), stringifyPlanningDoc(migrated));
        upsertPlanningProjectMeta({
          id: migrated.projetId,
          nom: migrated.projetNom,
          updatedAt: new Date().toISOString(),
        });
        list = readPlanningProjectList();
      }
      let activeId = sessionStorage.getItem(PLANNING_LAST_PROJECT_KEY) ?? "";
      if (!list.some((p) => p.id === activeId)) activeId = list[0]?.id ?? "";
      if (!activeId) {
        const fresh = defaultPlanningDoc();
        localStorage.setItem(planningDocStorageKey(fresh.projetId), stringifyPlanningDoc(fresh));
        upsertPlanningProjectMeta({
          id: fresh.projetId,
          nom: fresh.projetNom,
          updatedAt: new Date().toISOString(),
        });
        activeId = fresh.projetId;
      }
      const raw = localStorage.getItem(planningDocStorageKey(activeId));
      setDoc(parsePlanningDoc(raw));
      sessionStorage.setItem(PLANNING_LAST_PROJECT_KEY, activeId);
    } catch {
      setDoc(defaultPlanningDoc());
    }
    setStorageReady(true);
  }, [initialJson]);

  useEffect(() => {
    if (typeof window === "undefined" || initialJson || !storageReady) return;
    try {
      localStorage.setItem(planningDocStorageKey(doc.projetId), stringifyPlanningDoc(doc));
      upsertPlanningProjectMeta({
        id: doc.projetId,
        nom: doc.projetNom.trim() || "Sans nom",
        updatedAt: new Date().toISOString(),
      });
      sessionStorage.setItem(PLANNING_LAST_PROJECT_KEY, doc.projetId);
    } catch {
      /* quota / privé */
    }
  }, [doc, initialJson, storageReady]);

  const anchorMonday = useMemo(() => mondayOfIsoWeek(doc.dateDebutISO), [doc.dateDebutISO]);
  const { min, max } = useMemo(() => weekRange(doc), [doc.bars]);
  const horizonWeeks = Math.max(8, Math.ceil(doc.horizonMois * (52 / 12)));
  const totalWeeks = Math.max(max + 3, min + 24, horizonWeeks);
  const yearSpans = useMemo(() => yearSpansFromWeeks(anchorMonday, totalWeeks), [anchorMonday, totalWeeks]);
  const monthSpans = useMemo(() => monthNameSpansFromWeeks(anchorMonday, totalWeeks), [anchorMonday, totalWeeks]);
  const rows = useMemo(() => sortedBars(doc), [doc]);
  const projectList = readPlanningProjectList();

  const { y: debutAnnee, m: debutMois } = parseYmd(doc.dateDebutISO);

  const persistCurrentThen = useCallback(
    (fn: () => void) => {
      if (initialJson) {
        fn();
        return;
      }
      try {
        localStorage.setItem(planningDocStorageKey(doc.projetId), stringifyPlanningDoc(doc));
        upsertPlanningProjectMeta({
          id: doc.projetId,
          nom: doc.projetNom.trim() || "Sans nom",
          updatedAt: new Date().toISOString(),
        });
      } catch {
        /* ignore */
      }
      fn();
    },
    [doc, initialJson],
  );

  const switchToProject = useCallback(
    (nextId: string) => {
      if (nextId === doc.projetId) return;
      persistCurrentThen(() => {
        const raw = localStorage.getItem(planningDocStorageKey(nextId));
        let nextDoc: PlanningGanttDoc;
        if (raw?.trim()) {
          nextDoc = parsePlanningDoc(raw);
        } else {
          nextDoc = defaultPlanningDoc();
          nextDoc.projetId = nextId;
          nextDoc.projetNom = readPlanningProjectList().find((p) => p.id === nextId)?.nom ?? "Projet";
        }
        if (nextDoc.projetId !== nextId) nextDoc = { ...nextDoc, projetId: nextId };
        setDoc(nextDoc);
        sessionStorage.setItem(PLANNING_LAST_PROJECT_KEY, nextId);
        setSelectedId(null);
      });
    },
    [doc.projetId, persistCurrentThen],
  );

  const createNewProject = useCallback(() => {
    persistCurrentThen(() => {
      const fresh = defaultPlanningDoc();
      localStorage.setItem(planningDocStorageKey(fresh.projetId), stringifyPlanningDoc(fresh));
      upsertPlanningProjectMeta({
        id: fresh.projetId,
        nom: fresh.projetNom,
        updatedAt: new Date().toISOString(),
      });
      setDoc(fresh);
      sessionStorage.setItem(PLANNING_LAST_PROJECT_KEY, fresh.projetId);
      setSelectedId(null);
    });
  }, [persistCurrentThen]);

  const updateBar = useCallback((id: string, patch: Partial<GanttBar>) => {
    setDoc((d) => ({
      ...d,
      bars: d.bars.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }));
  }, []);

  const updateLot = useCallback((id: string, patch: Partial<PlanningLot>) => {
    setDoc((d) => ({
      ...d,
      lots: d.lots.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));
  }, []);

  const addLot = useCallback(() => {
    const id = `lot-${Date.now()}`;
    const palette = defaultGenericLots();
    const couleur = palette[doc.lots.length % palette.length]!.couleur;
    setDoc((d) => ({
      ...d,
      lots: [...d.lots, { id, libelle: `Lot ${d.lots.length + 1}`, couleur }],
    }));
  }, [doc.lots.length]);

  const removeLot = useCallback((lotId: string) => {
    setDoc((d) => {
      if (d.lots.length <= 1) return d;
      const remaining = d.lots.filter((l) => l.id !== lotId);
      const fallback = remaining[0]!.id;
      return {
        ...d,
        lots: remaining,
        bars: d.bars.map((b) => (b.lotId === lotId ? { ...b, lotId: fallback } : b)),
      };
    });
  }, []);

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) => {
      const dw = Math.round((e.clientX - drag.originX) / WEEK_W);
      const next = Math.max(0, drag.originDebut + dw);
      setDoc((d) => ({
        ...d,
        bars: d.bars.map((b) => (b.id === drag.barId ? { ...b, debutSemaine: next } : b)),
      }));
    };
    const onUp = () => setDrag(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag]);

  const selected = doc.bars.find((b) => b.id === selectedId) ?? null;

  const resetTemplate = () => {
    const base = defaultPlanningDoc();
    setDoc({
      ...base,
      projetId: doc.projetId,
      projetNom: doc.projetNom,
      projetRef: doc.projetRef,
      horizonMois: doc.horizonMois,
      titre: doc.titre.trim() || base.titre,
      dateDebutISO: doc.dateDebutISO,
      elements: doc.elements.length ? [...doc.elements] : [...base.elements],
      lots: doc.lots.length ? doc.lots.map((l) => ({ ...l })) : [...base.lots],
      sousTitre:
        doc.elements.length > 0
          ? `${doc.elements.length} ligne(s) : ${doc.elements.join(" · ")}`
          : base.sousTitre,
      bars: buildGenericTemplateBars(
        doc.elements.length ? doc.elements : base.elements,
        doc.lots.length ? doc.lots : base.lots,
      ),
    });
    setSelectedId(null);
  };

  const applyElementsList = () => {
    const els = doc.elements.filter(Boolean);
    setDoc((d) => ({
      ...d,
      bars: buildGenericTemplateBars(els, d.lots),
      sousTitre: `${els.length} ligne(s) : ${els.join(" · ")}`,
    }));
  };

  const addBar = () => {
    const id = `custom-${Date.now()}`;
    setDoc((d) => ({
      ...d,
      bars: [
        ...d.bars,
        {
          id,
          lotId: d.lots[0]?.id ?? "lot-1",
          libelle: "Nouvelle tâche",
          debutSemaine: 0,
          dureeSemaines: 2,
        },
      ],
    }));
    setSelectedId(id);
  };

  const removeBar = (id: string) => {
    setDoc((d) => ({ ...d, bars: d.bars.filter((b) => b.id !== id) }));
    if (selectedId === id) setSelectedId(null);
  };

  const exportJson = () => {
    const blob = new Blob([stringifyPlanningDoc(doc)], { type: "application/json;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${safeExportBasename(doc.projetNom)}_${doc.projetId.slice(-8)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const timelineWidth = totalWeeks * WEEK_W;

  return (
    <div className="space-y-4">
      {!initialJson ? (
        <div className="fcard">
          <div className="fcard-body">
            <p className="crm-stack-title mb-3">Projet (comme un classeur Excel — un planning par projet)</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-12 lg:items-end">
              <div className="crm-field lg:col-span-3">
                <label htmlFor="gantt-sel-proj" className="crm-label">
                  Ouvrir un projet
                </label>
                <select
                  id="gantt-sel-proj"
                  className="crm-select"
                  value={doc.projetId}
                  onChange={(e) => switchToProject(e.target.value)}
                >
                  {!projectList.some((p) => p.id === doc.projetId) ? (
                    <option value={doc.projetId}>
                      {doc.projetNom} (courant)
                    </option>
                  ) : null}
                  {projectList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nom}
                    </option>
                  ))}
                </select>
              </div>
              <label className="crm-field lg:col-span-3">
                <span className="crm-label">Nom du projet</span>
                <input className="crm-input" value={doc.projetNom} onChange={(e) => setDoc((d) => ({ ...d, projetNom: e.target.value }))} placeholder="Ex. Hôpital — aile B" />
              </label>
              <label className="crm-field lg:col-span-2">
                <span className="crm-label">Réf. / code</span>
                <input
                  className="crm-input"
                  value={doc.projetRef ?? ""}
                  onChange={(e) => setDoc((d) => ({ ...d, projetRef: e.target.value }))}
                  placeholder="Site, commande…"
                />
              </label>
              <label className="crm-field lg:col-span-2">
                <span className="crm-label">Horizon (mois)</span>
                <input
                  type="number"
                  min={6}
                  max={60}
                  className="crm-input"
                  value={doc.horizonMois}
                  onChange={(e) =>
                    setDoc((d) => ({
                      ...d,
                      horizonMois: Math.min(60, Math.max(6, Math.round(Number(e.target.value) || 24))),
                    }))
                  }
                />
                <span className="crm-hint">Tous les mois de la période apparaissent sur la frise.</span>
              </label>
              <div className="crm-field flex flex-wrap gap-2 lg:col-span-2">
                <span className="crm-label w-full">Création</span>
                <button type="button" className="cbtn cbtn-orange cbtn-sm" onClick={createNewProject}>
                  Nouveau projet
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-[var(--g300)] shadow-sm">
        <div className="flex flex-col gap-0 md:flex-row md:items-stretch">
          <div className="min-w-0 flex-1">
            <input
              className="gantt-banner-title-input w-full border-b border-white/20 bg-[#1a365d] px-3 py-2.5 text-sm font-bold text-white placeholder:text-white/70 md:text-[13px]"
              value={doc.titre}
              onChange={(e) => setDoc((d) => ({ ...d, titre: e.target.value }))}
              aria-label="Titre du planning"
            />
            <input
              className="gantt-banner-sub-input w-full bg-[#ea580c] px-3 py-2 text-xs font-semibold text-white placeholder:text-white/80 md:text-[13px]"
              value={doc.sousTitre}
              onChange={(e) => setDoc((d) => ({ ...d, sousTitre: e.target.value }))}
              aria-label="Sous-titre"
            />
          </div>
          <div className="flex items-center justify-center border-t border-[var(--g300)] bg-[var(--g50)] px-4 py-2 md:border-l md:border-t-0">
            <Image src={LVO_LOGO_SRC} alt={LVO_LOGO_ALT} width={140} height={42} className="h-10 w-auto max-w-[160px] object-contain" priority />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 border-b border-[var(--g300)] bg-[var(--g50)] p-4 md:grid-cols-2 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,2.2fr)_minmax(0,1.1fr)]">
          <div className="crm-field">
            <span className="crm-label">Début du planning</span>
            <span className="crm-hint">Semaine 0 = lundi de la semaine contenant la date. Année et mois modifiables ci-dessous.</span>
            <input
              type="date"
              className="crm-input crm-input--sm"
              value={doc.dateDebutISO}
              onChange={(e) => setDoc((d) => ({ ...d, dateDebutISO: e.target.value }))}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <select
                className="crm-select crm-input--sm min-w-[100px] flex-1"
                aria-label="Année de début"
                value={debutAnnee}
                onChange={(e) => {
                  const y = Number(e.target.value);
                  setDoc((d) => ({ ...d, dateDebutISO: isoWithYearMonth(d.dateDebutISO, y, parseYmd(d.dateDebutISO).m) }));
                }}
              >
                {!ANNEE_OPTIONS.includes(debutAnnee) ? (
                  <option value={debutAnnee}>
                    {debutAnnee}
                  </option>
                ) : null}
                {ANNEE_OPTIONS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <select
                className="crm-select crm-input--sm min-w-[130px] flex-1"
                aria-label="Mois de début"
                value={debutMois}
                onChange={(e) => {
                  const m = Number(e.target.value);
                  setDoc((d) => ({ ...d, dateDebutISO: isoWithYearMonth(d.dateDebutISO, parseYmd(d.dateDebutISO).y, m) }));
                }}
              >
                {MOIS_OPTIONS.map(({ mois, label }) => (
                  <option key={mois} value={mois}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label className="crm-field md:col-span-2 lg:col-span-1">
            <span className="crm-label">Lignes d&apos;ouvrage / équipements</span>
            <span className="crm-hint">Libellés séparés par des virgules</span>
            <input
              className="crm-input crm-input--mono crm-input--sm"
              value={doc.elements.join(", ")}
              onChange={(e) =>
                setDoc((d) => ({
                  ...d,
                  elements: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                }))
              }
            />
          </label>
          <div className="crm-field justify-end md:col-span-2 lg:col-span-1">
            <span className="crm-label">Actions</span>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="cbtn cbtn-orange cbtn-sm" onClick={applyElementsList}>
                Appliquer → barres
              </button>
              <button type="button" className="cbtn cbtn-ghost cbtn-sm" onClick={resetTemplate}>
                Modèle
              </button>
              <button type="button" className="cbtn cbtn-ghost cbtn-sm" onClick={exportJson}>
                JSON
              </button>
              <button type="button" className="cbtn cbtn-ghost cbtn-sm" onClick={addBar}>
                + Tâche
              </button>
            </div>
          </div>
        </div>

        <div className="border-b border-[var(--g300)] bg-white p-4">
          <p className="crm-stack-title mb-3">Lots — noms &amp; couleurs (chaque tâche est rattachée à un lot)</p>
          <div className="flex flex-col gap-2">
            {doc.lots.map((lot) => (
              <div key={lot.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--g200)] bg-[var(--g50)] px-3 py-2">
                <input
                  className="crm-input crm-input--sm min-w-[120px] flex-1"
                  value={lot.libelle}
                  onChange={(e) => updateLot(lot.id, { libelle: e.target.value })}
                  aria-label={`Libellé ${lot.id}`}
                />
                <input
                  type="color"
                  className="h-9 w-14 shrink-0 cursor-pointer rounded-lg border border-[var(--g300)] bg-white p-0.5"
                  value={lot.couleur}
                  onChange={(e) => updateLot(lot.id, { couleur: e.target.value })}
                  aria-label={`Couleur ${lot.id}`}
                />
                <span className="font-mono text-[10px] text-neutral-400">{lot.id}</span>
                <button
                  type="button"
                  className="ml-auto text-xs text-red-700 hover:underline disabled:opacity-30"
                  disabled={doc.lots.length <= 1}
                  onClick={() => removeLot(lot.id)}
                >
                  Retirer le lot
                </button>
              </div>
            ))}
            <button type="button" className="cbtn cbtn-ghost cbtn-sm self-start" onClick={addLot}>
              + Ajouter un lot
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row">
          <div className="min-w-0 flex-1 overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="flex" style={{ paddingLeft: LEFT_GUTTER }}>
                <div className="flex border-b border-[var(--g300)] bg-[#dfe6f3]" style={{ width: timelineWidth }}>
                  {yearSpans.map((s, i) => (
                    <div
                      key={`y-${s.label}-${i}`}
                      className="flex items-center justify-center border-r border-[var(--g300)] text-[11px] font-bold tabular-nums text-[#1a365d]"
                      style={{ width: s.weeks * WEEK_W, minWidth: s.weeks * WEEK_W }}
                    >
                      {s.label}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex" style={{ paddingLeft: LEFT_GUTTER }}>
                <div className="flex border-b border-[var(--g300)] bg-neutral-100" style={{ width: timelineWidth }}>
                  {monthSpans.map((s, i) => (
                    <div
                      key={`${s.label}-m-${i}`}
                      className="flex items-center justify-center border-r border-[var(--g300)] px-0.5 text-center text-[10px] font-semibold leading-tight text-[#1a365d]"
                      style={{ width: s.weeks * WEEK_W, minWidth: s.weeks * WEEK_W }}
                      title={s.label}
                    >
                      {s.label}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex border-b border-[var(--g300)] bg-white" style={{ paddingLeft: LEFT_GUTTER }}>
                <div className="flex text-[10px] text-neutral-500" style={{ width: timelineWidth }}>
                  {Array.from({ length: totalWeeks }, (_, w) => {
                    const dt = addWeeksMonday(anchorMonday, w);
                    const dd = dt.getDate();
                    return (
                      <div
                        key={`w-${doc.dateDebutISO}-${w}`}
                        className="flex shrink-0 items-end justify-center border-r border-[var(--g200)] pb-0.5"
                        style={{ width: WEEK_W }}
                      >
                        {dd}
                      </div>
                    );
                  })}
                </div>
              </div>

              {rows.map((bar) => (
                <div key={bar.id} className="flex border-b border-[var(--g200)] hover:bg-neutral-50/80">
                  <div
                    className="flex shrink-0 items-center border-r border-[var(--g300)] bg-white px-2 text-[11px] font-medium text-neutral-800"
                    style={{ width: LANE_COL_W }}
                  >
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ background: lotCouleur(doc, bar.lotId) }}
                      title={lotLibelle(doc, bar.lotId)}
                    />
                    <span className="ml-1.5 truncate" title={lotLibelle(doc, bar.lotId)}>
                      {lotLibelle(doc, bar.lotId)}
                    </span>
                  </div>
                  <div
                    className="flex shrink-0 items-center border-r border-[var(--g300)] bg-[var(--g50)] px-2 text-[11px] text-neutral-700"
                    style={{ width: TASK_COL_W }}
                  >
                    <span className="line-clamp-2 leading-tight" title={bar.libelle}>
                      {bar.libelle}
                    </span>
                  </div>
                  <div className="relative flex-1 overflow-hidden bg-white">
                    <div className="relative" style={{ width: timelineWidth, height: ROW_H }}>
                      {Array.from({ length: totalWeeks }, (_, w) => (
                        <div
                          key={`grid-${bar.id}-${w}`}
                          className="absolute top-0 border-r border-[var(--g200)]"
                          style={{ left: w * WEEK_W, width: WEEK_W, height: ROW_H }}
                        />
                      ))}
                      <button
                        type="button"
                        className={`absolute top-1 flex cursor-grab items-center justify-center rounded border border-black/10 px-0.5 text-[10px] font-semibold text-white shadow-sm active:cursor-grabbing ${
                          selectedId === bar.id ? "ring-2 ring-orange-400 ring-offset-1" : ""
                        }`}
                        style={{
                          left: bar.debutSemaine * WEEK_W + 1,
                          width: Math.max(bar.dureeSemaines * WEEK_W - 2, 8),
                          height: ROW_H - 8,
                          background: lotCouleur(doc, bar.lotId),
                        }}
                        title="Glisser pour décaler — clic pour éditer"
                        onClick={() => setSelectedId(bar.id)}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setSelectedId(bar.id);
                          setDrag({ barId: bar.id, originX: e.clientX, originDebut: bar.debutSemaine });
                        }}
                      >
                        <span className="truncate px-0.5">{bar.dureeSemaines}&nbsp;sem.</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside className="w-full shrink-0 border-t border-[var(--g300)] bg-[var(--g50)] p-4 lg:w-72 lg:border-l lg:border-t-0">
            <p className="crm-stack-title mb-3">Édition</p>
            {selected ? (
              <div className="flex flex-col gap-3">
                <div className="crm-field">
                  <span className="crm-label">Lot</span>
                  <select className="crm-select" value={selected.lotId} onChange={(e) => updateBar(selected.id, { lotId: e.target.value })}>
                    {doc.lots.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.libelle}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="crm-field">
                  <span className="crm-label">Libellé</span>
                  <input className="crm-input crm-input--sm" value={selected.libelle} onChange={(e) => updateBar(selected.id, { libelle: e.target.value })} />
                </label>
                <label className="crm-field">
                  <span className="crm-label">Début (semaine)</span>
                  <input
                    type="number"
                    min={0}
                    className="crm-input crm-input--sm"
                    value={selected.debutSemaine}
                    onChange={(e) =>
                      updateBar(selected.id, { debutSemaine: Math.max(0, Math.round(Number(e.target.value) || 0)) })
                    }
                  />
                </label>
                <label className="crm-field">
                  <span className="crm-label">Durée (semaines)</span>
                  <input
                    type="number"
                    min={1}
                    className="crm-input crm-input--sm"
                    value={selected.dureeSemaines}
                    onChange={(e) =>
                      updateBar(selected.id, { dureeSemaines: Math.max(1, Math.round(Number(e.target.value) || 1)) })
                    }
                  />
                </label>
                <p className="crm-hint">
                  Début calendaire : {addWeeksMonday(anchorMonday, selected.debutSemaine).toLocaleDateString("fr-FR")}
                </p>
                <button type="button" className="cbtn cbtn-ghost cbtn-sm text-red-700" onClick={() => removeBar(selected.id)}>
                  Supprimer cette tâche
                </button>
              </div>
            ) : (
              <p className="crm-hint">Sélectionnez une barre pour modifier lot, libellé et semaines.</p>
            )}
          </aside>
        </div>
      </div>
      <p className="crm-hint max-w-3xl">
        {!initialJson
          ? `Chaque projet est enregistré séparément (${planningDocStorageKey(doc.projetId)} + index). Export JSON possible pour archiver ou partager.`
          : "Mode aperçu : données non persistées dans le navigateur."}
      </p>
    </div>
  );
}
