"use client";

import Link from "next/link";

import { RecouvrementClient } from "@/components/crm/RecouvrementClient";
import { canAccessRecouvrement, getCrmHomeHref, normalizeRole } from "@/lib/rbac";
import { readRole } from "@/lib/token-storage";

export default function RecouvrementPage() {
  const r = normalizeRole(readRole());

  if (!canAccessRecouvrement(r)) {
    return (
      <header className="pg-hdr mb-4">
        <div>
          <h1>Recouvrement</h1>
          <p className="text-neutral-600">
            Accès réservé aux profils <strong>Manager</strong> et <strong>Administrateur</strong>.
          </p>
          <Link href={getCrmHomeHref(r)} className="cbtn cbtn-ghost cbtn-sm mt-3 inline-block">
            ← Accueil CRM
          </Link>
        </div>
      </header>
    );
  }

  return <RecouvrementClient />;
}
