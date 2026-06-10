"use client";

import { useEffect, type ReactNode } from "react";

export type CrmModalSize = "sm" | "md" | "lg" | "xl";

const SIZE_CLASS: Record<CrmModalSize, string> = {
  sm: "crm-modal-shell--sm",
  md: "crm-modal-shell--md",
  lg: "crm-modal-shell--lg",
  xl: "crm-modal-shell--xl",
};

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  titleId?: string;
  size?: CrmModalSize;
  zIndex?: number;
  error?: string | null;
  children: ReactNode;
  footer?: ReactNode;
  closeOnBackdrop?: boolean;
};

export function CrmEntityModal({
  open,
  onClose,
  title,
  subtitle,
  titleId = "crm-modal-title",
  size = "lg",
  zIndex,
  error,
  children,
  footer,
  closeOnBackdrop = true,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="crm-modal-backdrop"
      style={zIndex != null ? { zIndex } : undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={
        closeOnBackdrop
          ? (e) => {
              if (e.target === e.currentTarget) onClose();
            }
          : undefined
      }
    >
      <div className={`crm-modal-shell fcard ${SIZE_CLASS[size]}`}>
        <div className="fcard-hdr crm-modal-hdr">
          <div className="min-w-0 flex-1">
            <h2 id={titleId}>{title}</h2>
            {subtitle ? <div className="fcard-hdr-sub">{subtitle}</div> : null}
          </div>
          <button type="button" className="cbtn cbtn-ghost cbtn-sm shrink-0" onClick={onClose}>
            Fermer
          </button>
        </div>
        <div className="fcard-body crm-modal-body">
          {error ? <p className="crm-alert crm-alert--error">{error}</p> : null}
          {children}
        </div>
        {footer ? <div className="crm-modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}

export function CrmModalActions({ children }: { children: ReactNode }) {
  return <div className="crm-modal-footer">{children}</div>;
}
