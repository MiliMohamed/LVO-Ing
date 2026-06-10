"use client";

import Link from "next/link";

import { canMutate, getCrmHomeHref, normalizeRole, roleBadgeLabel } from "@/lib/rbac";
import { readRole } from "@/lib/token-storage";

export function NouveauGate({ children }: { children: React.ReactNode }) {
  const role = normalizeRole(readRole());
  if (!canMutate(role)) {
    return (
      <div className="fcard mx-auto max-w-lg">
        <div className="fcard-body space-y-3">
          <h1 className="text-lg font-bold text-[var(--navy)]">Création non disponible</h1>
          <p className="text-sm text-neutral-600">
            Les formulaires de création sont réservés aux profils{" "}
            <strong>Consultant</strong>, <strong>Manager</strong> et <strong>Administrateur</strong>. Votre session est{" "}
            <strong>{roleBadgeLabel(role)}</strong>.
          </p>
          <Link href={getCrmHomeHref(role)} className="cbtn cbtn-orange cbtn-sm inline-flex">
            Retour à l&apos;accueil CRM
          </Link>
        </div>
      </div>
    );
  }
  return children;
}
