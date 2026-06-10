"use client";

import { Card } from "primereact/card";
import type { ReactNode } from "react";

type Props = {
  title?: string;
  subTitle?: string;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
};

export function CrmCard({ title, subTitle, children, className = "", footer }: Props) {
  return (
    <Card title={title} subTitle={subTitle} className={`crm-form-card ${className}`.trim()} footer={footer}>
      {children}
    </Card>
  );
}
