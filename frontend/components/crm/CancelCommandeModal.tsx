"use client";

import { useEffect, useState } from "react";

import { CrmEntityModal } from "@/components/crm/ui/CrmEntityModal";
import { apiFetch } from "@/lib/api";
import { readToken } from "@/lib/token-storage";
import type { CommandeRow } from "@/lib/types";

export type FactureCommandeLight = {
  id: number;
  numeroFacture: string;
  montantHt: number;
  frais: number;
  statutPaiement: string;
  payee: boolean;
  dateFacture: string | null;
};

const moneyFr = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export function CancelCommandeModal({
  commande,
  onClose,
  onDone,
}: {
  commande: CommandeRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [factures, setFactures] = useState<FactureCommandeLight[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [motif, setMotif] = useState("Refus client");
  const [commentaire, setCommentaire] = useState("");
  const [emitAvoirs, setEmitAvoirs] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const token = readToken();
    let cancelled = false;
    void (async () => {
      try {
        const d = (await apiFetch(`/api/commandes/${commande.id}/factures`, {
          token,
        })) as FactureCommandeLight[] | null;
        const list = Array.isArray(d) ? d : [];
        if (cancelled) return;
        setFactures(list);
        const unpaid = list.filter((f) => !f.payee).map((f) => f.id);
        setSelected(new Set(unpaid.length ? unpaid : list.map((f) => f.id)));
      } catch {
        if (!cancelled) {
          setFactures([]);
          setSelected(new Set());
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [commande.id]);

  function toggleId(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    const m = motif.trim();
    if (!m) {
      setErr("Motif obligatoire");
      return;
    }
    const withAvoirs = emitAvoirs && selected.size > 0;
    if (emitAvoirs && selected.size === 0) {
      setErr("Cochez « Créer des avoirs » uniquement si vous sélectionnez au moins une facture, ou décochez l’option.");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      await apiFetch(`/api/commandes/${commande.id}/cancel`, {
        token: readToken(),
        method: "POST",
        body: JSON.stringify({
          motif: m,
          commentaire: commentaire.trim() || null,
          factureIds: withAvoirs ? [...selected] : [],
          emitAvoirs: withAvoirs,
        }),
      });
      onDone();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <CrmEntityModal
      open
      onClose={onClose}
      title="Annuler la commande"
      subtitle={`${commande.numeroCommande} — ${commande.clientNom}`}
      titleId="cancel-cmd-title"
      size="md"
      error={err}
      footer={
        <>
          <button type="button" className="cbtn cbtn-primary" disabled={busy || factures === null} onClick={() => void submit()}>
            {busy ? "Traitement…" : "Confirmer l’annulation"}
          </button>
          <button type="button" className="cbtn cbtn-ghost" disabled={busy} onClick={onClose}>
            Fermer
          </button>
        </>
      }
    >
      <div className="crm-form-grid crm-form-grid--tight">
        <label className="crm-field crm-span-2">
          <span className="crm-label">
            Motif <span className="crm-req">*</span>
          </span>
          <input className="crm-input" value={motif} onChange={(e) => setMotif(e.target.value)} />
        </label>
        <label className="crm-field crm-span-2">
          <span className="crm-label">Commentaire (optionnel)</span>
          <textarea
            className="crm-textarea min-h-[72px]"
            rows={2}
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
          />
        </label>
        <label className="crm-field-check crm-span-2">
          <input type="checkbox" checked={emitAvoirs} onChange={(e) => setEmitAvoirs(e.target.checked)} />
          Créer des avoirs pour les factures cochées (MANAGER / ADMIN)
        </label>
        <p className="crm-hint crm-span-2">
          Sans case cochée : annulation seule, sans avoir. Avec case et factures : un avoir par facture sélectionnée.
        </p>
      </div>

      <div className="crm-list-panel mt-3">
        {factures === null ? (
          <p className="crm-list-panel__empty">Chargement des factures…</p>
        ) : factures.length === 0 ? (
          <p className="crm-list-panel__empty">Aucune facture liée à cette commande.</p>
        ) : (
          factures.map((f) => {
            const total = f.montantHt + f.frais;
            return (
              <label key={f.id} className="crm-list-panel__item cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={selected.has(f.id)}
                  onChange={() => toggleId(f.id)}
                  disabled={!emitAvoirs}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[var(--navy)]">{f.numeroFacture}</div>
                  <div className="text-xs text-[var(--g600)]">
                    {moneyFr.format(total)} — {f.payee ? "Payée" : f.statutPaiement}
                    {f.dateFacture ? ` — ${f.dateFacture}` : ""}
                  </div>
                </div>
              </label>
            );
          })
        )}
      </div>
    </CrmEntityModal>
  );
}
