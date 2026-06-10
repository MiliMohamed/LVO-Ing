"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { getCrmHomeHref, normalizeRole, roleBadgeLabel, type AppRole } from "@/lib/rbac";
import { readRole } from "@/lib/token-storage";

type Props = {
  /** Si false, affiche un écran d’accès refusé */
  allowed: (role: AppRole | null) => boolean;
  title: string;
  description: string;
  children: ReactNode;
};

export function CrmRoleGate({ allowed, title, description, children }: Props) {
  const role = normalizeRole(readRole());

  if (!allowed(role)) {
    const home = getCrmHomeHref(role);
    return (
      <div className="crm-access-denied">
        <header className="pg-hdr mb-2">
          <h1>{title}</h1>
          <p className="text-neutral-600">{description}</p>
        </header>
        <p className="mb-4 text-sm text-neutral-700">
          Profil connecté : <strong>{roleBadgeLabel(role)}</strong>
        </p>
        <Link href={home} className="cbtn cbtn-orange cbtn-sm inline-flex">
          ← Retour à l&apos;espace CRM
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
