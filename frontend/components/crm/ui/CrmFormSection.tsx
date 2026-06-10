"use client";

import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function CrmFormSection({ title, description, children, className = "" }: Props) {
  return (
    <section className={`mb-6 last:mb-0 ${className}`.trim()}>
      <h3 className="crm-form-section-title">{title}</h3>
      {description ? <p className="crm-field-hint mb-3 -mt-1">{description}</p> : null}
      <div className="crm-form-grid cols-2">{children}</div>
    </section>
  );
}
