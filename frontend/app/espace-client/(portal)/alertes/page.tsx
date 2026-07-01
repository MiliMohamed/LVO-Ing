"use client";

import { useEffect, useState } from "react";
import { clientApiFetch, clientApiPost } from "@/lib/client-api";

type AlertesConfig = {
  entreprise: string;
  factureImpayee: boolean;
  factureImpayeeDelaiJours: number;
  contratExpirant: boolean;
  panneSignalee: boolean;
  mmsSousSeuilCritique: boolean;
  mmsSeuil: number;
  offreExpirant: boolean;
  visiteReglementaire: boolean;
  updatedAt: string;
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer",
        background: checked ? "var(--navy)" : "#d1d5db",
        position: "relative", transition: "background 0.2s", flexShrink: 0,
      }}
    >
      <span style={{
        position: "absolute", top: 3, left: checked ? 20 : 3,
        width: 16, height: 16, borderRadius: "50%", background: "#fff",
        transition: "left 0.2s", display: "block",
      }} />
    </button>
  );
}

function AlertRow({
  icon, label, description, checked, onToggle, children,
}: {
  icon: string; label: string; description: string;
  checked: boolean; onToggle: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 16, padding: "16px 0",
      borderBottom: "1px solid var(--g100)",
    }}>
      <span style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--navy)", marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 12, color: "var(--smoke)", marginBottom: children ? 10 : 0 }}>{description}</div>
        {checked && children}
      </div>
      <Toggle checked={checked} onChange={onToggle} />
    </div>
  );
}

export default function AlertesPage() {
  const [config, setConfig] = useState<AlertesConfig | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void clientApiFetch<AlertesConfig>("/api/client/alertes-config")
      .then(setConfig)
      .catch(() => setError("Impossible de charger la configuration."));
  }, []);

  function update(patch: Partial<AlertesConfig>) {
    setConfig((c) => c ? { ...c, ...patch } : c);
    setSaved(false);
  }

  async function handleSave() {
    if (!config) return;
    setSaving(true); setSaved(false); setError(null);
    try {
      const updated = await clientApiPost<AlertesConfig>("/api/client/alertes-config", config);
      setConfig(updated); setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Erreur lors de la sauvegarde.");
    } finally { setSaving(false); }
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--navy)", marginBottom: 4 }}>Mes alertes</h1>
        <p style={{ fontSize: 13, color: "var(--smoke)" }}>Configurez les notifications que vous souhaitez recevoir</p>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", color: "#dc2626", marginBottom: 20 }}>
          {error}
        </div>
      )}

      {config === null && !error && (
        <div style={{ color: "var(--smoke)", padding: "40px 0", textAlign: "center" }}>Chargement…</div>
      )}

      {config && (
        <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 14, padding: "8px 24px 24px" }}>

          <AlertRow
            icon="🧾" label="Facture impayée"
            description="Alerte lorsqu'une facture dépasse le délai de paiement défini."
            checked={config.factureImpayee}
            onToggle={(v) => update({ factureImpayee: v })}
          >
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
              <span style={{ color: "var(--smoke)" }}>Délai :</span>
              <select
                value={config.factureImpayeeDelaiJours}
                onChange={(e) => update({ factureImpayeeDelaiJours: Number(e.target.value) })}
                style={{ border: "1px solid var(--g200)", borderRadius: 6, padding: "4px 10px", fontSize: 13 }}
              >
                <option value={30}>30 jours</option>
                <option value={60}>60 jours</option>
                <option value={90}>90 jours</option>
              </select>
              <span style={{ color: "var(--smoke)" }}>après échéance</span>
            </label>
          </AlertRow>

          <AlertRow
            icon="📄" label="Contrat expirant"
            description="Alerte J-90, J-60 et J-30 avant expiration d'un contrat de maintenance."
            checked={config.contratExpirant}
            onToggle={(v) => update({ contratExpirant: v })}
          />

          <AlertRow
            icon="🔧" label="Panne signalée"
            description="Notification immédiate lorsqu'une panne est déclarée sur un de vos sites."
            checked={config.panneSignalee}
            onToggle={(v) => update({ panneSignalee: v })}
          />

          <AlertRow
            icon="📊" label="MMS sous seuil critique"
            description="Alerte lorsque le score MMS d'un prestataire passe sous votre seuil."
            checked={config.mmsSousSeuilCritique}
            onToggle={(v) => update({ mmsSousSeuilCritique: v })}
          >
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
              <span style={{ color: "var(--smoke)" }}>Seuil :</span>
              <input
                type="number" min={0} max={100}
                value={config.mmsSeuil}
                onChange={(e) => update({ mmsSeuil: Number(e.target.value) })}
                style={{ border: "1px solid var(--g200)", borderRadius: 6, padding: "4px 10px", fontSize: 13, width: 70 }}
              />
              <span style={{ color: "var(--smoke)" }}>/ 100</span>
            </label>
          </AlertRow>

          <AlertRow
            icon="📋" label="Offre sur le point d'expirer"
            description="Alerte J-7 avant expiration d'une offre en attente de décision."
            checked={config.offreExpirant}
            onToggle={(v) => update({ offreExpirant: v })}
          />

          <AlertRow
            icon="⚖️" label="Visite réglementaire à venir"
            description="Rappel J-15 avant chaque échéance réglementaire sur vos équipements."
            checked={config.visiteReglementaire}
            onToggle={(v) => update({ visiteReglementaire: v })}
          />

          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 20 }}>
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              style={{
                background: "var(--navy)", color: "#fff", border: "none", borderRadius: 9,
                padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}
            >
              {saving ? "Sauvegarde…" : "Enregistrer les préférences"}
            </button>
            {saved && (
              <span style={{ color: "#16a34a", fontSize: 13, fontWeight: 700 }}>✅ Préférences sauvegardées</span>
            )}
          </div>

          {config.updatedAt && (
            <p style={{ fontSize: 11, color: "var(--smoke)", marginTop: 12 }}>
              Dernière modification : {new Date(config.updatedAt).toLocaleString("fr-FR")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
