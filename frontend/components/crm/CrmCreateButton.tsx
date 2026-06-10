"use client";

import Link from "next/link";

import type { CrmCreateSlug } from "@/lib/crm-create";
import { CRM_CREATE } from "@/lib/crm-create";
import { canMutate, normalizeRole } from "@/lib/rbac";
import { readRole } from "@/lib/token-storage";

type Props = {
  slug: CrmCreateSlug;
  /** Surcharge le libellé du bouton */
  label?: string;
  className?: string;
  size?: "sm" | "md";
};

export function CrmCreateButton({ slug, label, className = "", size = "sm" }: Props) {
  const role = normalizeRole(readRole());
  if (!canMutate(role)) return null;

  const meta = CRM_CREATE[slug];
  const text = label ?? meta.buttonLabel;

  return (
    <Link
      href={meta.href}
      className={`cbtn cbtn-orange ${size === "sm" ? "cbtn-sm" : ""} inline-flex items-center gap-1 ${className}`.trim()}
    >
      <span aria-hidden>+</span> {text}
    </Link>
  );
}
