"use client";

import { Button } from "primereact/button";

type Props = {
  onCancel?: () => void;
  cancelLabel?: string;
  submitLabel?: string;
  loading?: boolean;
  disabled?: boolean;
};

export function CrmFormActions({
  onCancel,
  cancelLabel = "Annuler",
  submitLabel = "Enregistrer",
  loading = false,
  disabled = false,
}: Props) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--g200)] pt-5">
      {onCancel ? (
        <Button
          type="button"
          label={cancelLabel}
          severity="secondary"
          outlined
          onClick={onCancel}
          disabled={loading}
        />
      ) : null}
      <Button type="submit" label={submitLabel} icon="pi pi-check" loading={loading} disabled={disabled || loading} />
    </div>
  );
}
