"use client";

import type { ReactNode } from "react";

type Props = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
  filteredCount: number;
  totalCount: number | null;
  countUnit?: string;
  children?: ReactNode;
  onClear?: () => void;
  /** Filtres additionnels (agence, gestionnaire…) — affiche le bouton « Effacer » */
  hasExtraFilters?: boolean;
};

export function CrmListFilters({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Filtrer la liste…",
  searchAriaLabel = "Filtrer la liste",
  filteredCount,
  totalCount,
  countUnit = "ligne(s)",
  children,
  onClear,
  hasExtraFilters = false,
}: Props) {
  const hasActiveFilter = searchValue.trim().length > 0 || hasExtraFilters;

  function clearAll() {
    onSearchChange("");
    onClear?.();
  }

  return (
    <div className="crm-list-filters" role="search">
      <div className="crm-list-filters__fields">
        <div className="crm-list-filters__search">
          <span className="crm-list-filters__search-icon pi pi-search" aria-hidden />
          <input
            type="search"
            className="crm-toolbar-input crm-toolbar-input--search"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label={searchAriaLabel}
          />
        </div>
        {children}
        {hasActiveFilter ? (
          <button type="button" className="cbtn cbtn-ghost cbtn-sm" onClick={clearAll}>
            Effacer les filtres
          </button>
        ) : null}
      </div>
      <p className="crm-list-filters__count" aria-live="polite">
        <strong>{filteredCount}</strong> / {totalCount ?? "…"} {countUnit}
      </p>
    </div>
  );
}
