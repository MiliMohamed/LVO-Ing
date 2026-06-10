"use client";

import { CrmRoleGate } from "@/components/crm/CrmRoleGate";
import { DashboardClient } from "@/components/crm/DashboardClient";
import { canViewDashboardKpi } from "@/lib/rbac";

export default function DashboardPage() {
  return (
    <CrmRoleGate
      allowed={canViewDashboardKpi}
      title="Dashboard KPI"
      description="Les indicateurs globaux et graphiques agrégés sont réservés au profil Administrateur."
    >
      <DashboardClient />
    </CrmRoleGate>
  );
}
