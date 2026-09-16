"use client";

import { AuditLogClient } from "@/components/crm/AuditLogClient";
import { CrmRoleGate } from "@/components/crm/CrmRoleGate";
import { canViewAuditLog } from "@/lib/rbac";

export default function AuditJournalPage() {
  return (
    <CrmRoleGate
      allowed={canViewAuditLog}
      title="Journal d'audit"
      description="Consultation du journal réservée au profil Administrateur."
    >
      <header className="pg-hdr mb-4">
        <div>
          <h1>Journal d&apos;audit</h1>
          <p>Traçabilité des actions sensibles sur le CRM (Phase 5).</p>
        </div>
      </header>
      <AuditLogClient />
    </CrmRoleGate>
  );
}
