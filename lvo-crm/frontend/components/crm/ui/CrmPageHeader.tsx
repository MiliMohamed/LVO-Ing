"use client";

import Link from "next/link";

import { CrmCreateButton } from "@/components/crm/CrmCreateButton";
import type { CrmCreateSlug } from "@/lib/crm-create";

type Action = {
  label: string;
  href: string;
  ghost?: boolean;
};

type Props = {
  title: string;
  subtitle?: string;
  breadcrumbs?: { label: string; href?: string }[];
  /** Bouton orange « Nouveau … » sur la page courante */
  createSlug?: CrmCreateSlug;
  createLabel?: string;
  actions?: Action[];
};

export function CrmPageHeader({ title, subtitle, breadcrumbs, createSlug, createLabel, actions }: Props) {
  const hasActions = createSlug || (actions && actions.length > 0);

  return (
    <header className="pg-hdr mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav className="mb-2 flex flex-wrap items-center gap-1 text-xs text-neutral-500" aria-label="Fil d'Ariane">
            {breadcrumbs.map((b, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                {i > 0 ? <span aria-hidden className="text-neutral-300">/</span> : null}
                {b.href ? (
                  <Link href={b.href} className="hover:text-[var(--orange)]">
                    {b.label}
                  </Link>
                ) : (
                  <span className="text-neutral-700">{b.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : null}
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {hasActions ? (
        <div className="flex flex-wrap gap-2 shrink-0">
          {createSlug ? <CrmCreateButton slug={createSlug} label={createLabel} /> : null}
          {actions?.map((a) => (
            <Link
              key={a.label}
              href={a.href}
              className={`cbtn cbtn-sm ${a.ghost !== false ? "cbtn-ghost" : "cbtn-orange"}`}
            >
              {a.label}
            </Link>
          ))}
        </div>
      ) : null}
    </header>
  );
}
