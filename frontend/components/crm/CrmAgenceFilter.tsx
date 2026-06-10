"use client";

import { useEffect, useState } from "react";

import { AGENCE_SCOPES, readAgenceScope, saveAgenceScope, type AgenceScopeId } from "@/lib/agence-scope";
import { canViewDashboardKpi, normalizeRole } from "@/lib/rbac";
import { readRole } from "@/lib/token-storage";

export function CrmAgenceFilter() {
  const role = normalizeRole(readRole());
  const [scope, setScope] = useState<AgenceScopeId>("ALL");

  useEffect(() => {
    setScope(readAgenceScope());
  }, []);

  if (!role) return null;

  return (
    <label className="crm-agence-filter">
      <span className="crm-agence-filter-label">Périmètre</span>
      <select
        className="crm-agence-filter-select"
        value={scope}
        onChange={(e) => {
          const id = e.target.value as AgenceScopeId;
          setScope(id);
          saveAgenceScope(id);
        }}
        aria-label="Filtrer par agence"
      >
        {AGENCE_SCOPES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      {canViewDashboardKpi(role) ? (
        <span className="crm-agence-filter-hint" title="Les KPI dashboard restent globaux">
          (filtre listes)
        </span>
      ) : null}
    </label>
  );
}
