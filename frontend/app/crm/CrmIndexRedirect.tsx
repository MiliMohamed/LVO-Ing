"use client";

import { useRouter } from "next/navigation";
import { ProgressSpinner } from "primereact/progressspinner";
import { useEffect } from "react";

import { getCrmHomeHref, normalizeRole } from "@/lib/rbac";
import { readRole } from "@/lib/token-storage";

export function CrmIndexRedirect() {
  const router = useRouter();

  useEffect(() => {
    const home = getCrmHomeHref(normalizeRole(readRole()));
    router.replace(home);
  }, [router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center gap-3">
      <ProgressSpinner style={{ width: "2rem", height: "2rem" }} strokeWidth="4" />
      <p className="text-sm text-neutral-600">Redirection…</p>
    </div>
  );
}
