"use client";

import { useEffect, useState } from "react";

import { SiteArborescencePanel } from "@/components/crm/SiteArborescencePanel";
import { SiteEquipementsPanel } from "@/components/crm/SiteEquipementsPanel";
import { SiteGestionnairesPanel } from "@/components/crm/SiteGestionnairesPanel";
import { CrmEntityModal } from "@/components/crm/ui/CrmEntityModal";
import { apiFetch } from "@/lib/api";
import {
  canHardDeleteClient,
  canHardDeleteSite,
  normalizeRole,
  type AppRole,
} from "@/lib/rbac";
import { readRole, readToken } from "@/lib/token-storage";

export type Phase5EntityKind = "contact" | "client" | "site";

type Props = {
  open: boolean;
  kind: Phase5EntityKind;
  path: string;
  row: Record<string, unknown> | null;
  onClose: () => void;
  onSaved: () => void;
};

function role(): AppRole | null {
  return normalizeRole(readRole());
}

const KIND_LABEL: Record<Phase5EntityKind, string> = {
  contact: "Contact",
  client: "Client",
  site: "Site",
};

export function Phase5EntitySheet({ open, kind, path, row, onClose, onSaved }: Readonly<Props>) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [clientPwdBusy, setClientPwdBusy] = useState(false);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [pwdCopied, setPwdCopied] = useState(false);

  useEffect(() => {
    if (!open || !row) return;
    setEditing(false);
    setLocalErr(null);
    setNewPassword(null);
    setPwdCopied(false);
    const f: Record<string, string> = {};
    if (kind === "contact") {
      f.civilite = String(row.civilite ?? "");
      f.nom = String(row.nom ?? "");
      f.prenom = String(row.prenom ?? "");
      f.entreprise = String(row.entreprise ?? "");
      f.fonction = String(row.fonction ?? "");
      f.email = String(row.email ?? "");
      f.telephone = String(row.telephone ?? "");
      f.mobile = String(row.mobile ?? "");
    } else if (kind === "client") {
      f.raisonSociale = String(row.raisonSociale ?? "");
      f.entite = String(row.entite ?? "");
      f.email = String(row.email ?? "");
      f.telephone = String(row.telephone ?? "");
      f.siret = String(row.siret ?? "");
      f.codePostal = String(row.codePostal ?? "");
      f.responsableEmail = String(row.responsableEmail ?? "");
    } else {
      f.nom = String(row.nom ?? "");
      f.typeSite = String(row.typeSite ?? "");
      f.clientNom = String(row.clientNom ?? "");
      f.statut = String(row.statut ?? "ACTIF");
    }
    setForm(f);
  }, [open, row, kind]);

  if (!open || !row) return null;

  const id = Number(row.id);
  const r = role();
  const showDeleteClient = kind === "client" && canHardDeleteClient(r);
  const showDeleteSite = kind === "site" && canHardDeleteSite(r);
  const showDeleteContact = kind === "contact";

  async function save() {
    setLocalErr(null);
    setBusy(true);
    try {
      const body: Record<string, string> = { ...form };
      if (kind === "site") {
        body.statut = form.statut;
      }
      await apiFetch(`${path}/${id}`, {
        token: readToken(),
        method: "PATCH",
        body: JSON.stringify(body),
      });
      onSaved();
      setEditing(false);
    } catch (e) {
      setLocalErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!globalThis.confirm("Supprimer définitivement cette entrée ?")) return;
    setLocalErr(null);
    setBusy(true);
    try {
      await apiFetch(`${path}/${id}`, {
        token: readToken(),
        method: "DELETE",
      });
      onSaved();
      onClose();
    } catch (e) {
      setLocalErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function resetClientPassword() {
    setClientPwdBusy(true);
    setNewPassword(null);
    try {
      const data = await apiFetch(`${path}/${id}/reset-client-password`, {
        token: readToken(),
        method: "POST",
      }) as { newPassword: string };
      setNewPassword(data.newPassword);
      setPwdCopied(false);
    } catch (e) {
      setLocalErr(e instanceof Error ? e.message : "Erreur lors de la réinitialisation");
    } finally {
      setClientPwdBusy(false);
    }
  }

  function copyPassword() {
    if (!newPassword) return;
    void navigator.clipboard.writeText(newPassword).then(() => {
      setPwdCopied(true);
      setTimeout(() => setPwdCopied(false), 2000);
    });
  }

  function field(key: string, label: string) {
    const ro = !editing;
    return (
      <label className="crm-field">
        <span className="crm-label">{label}</span>
        <input
          className="crm-input"
          value={form[key] ?? ""}
          readOnly={ro}
          onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
        />
      </label>
    );
  }

  const subtitle = editing
    ? "Modification en cours — enregistrez ou annulez."
    : "Consultation — cliquez sur Modifier pour éditer.";

  function pwdBtnLabel(loading: boolean, hasPwd: boolean) {
    if (loading) return "Génération…";
    return hasPwd ? "🔄 Réinitialiser" : "🔑 Générer un mot de passe";
  }

  return (
    <CrmEntityModal
      open
      onClose={onClose}
      title={`${KIND_LABEL[kind]} #${id}`}
      subtitle={subtitle}
      size={kind === "site" ? "xl" : "lg"}
      error={localErr}
      footer={
        <>
          {!editing ? (
            <button type="button" className="cbtn-icon cbtn-icon--primary" title="Modifier" aria-label="Modifier" onClick={() => setEditing(true)}>
              ✎
            </button>
          ) : (
            <>
              <button type="button" className="cbtn cbtn-primary" disabled={busy} onClick={() => void save()}>
                Enregistrer
              </button>
              <button type="button" className="cbtn-icon cbtn-icon--ghost" title="Annuler l’édition" aria-label="Annuler l’édition" disabled={busy} onClick={() => setEditing(false)}>
                ✕
              </button>
            </>
          )}
          {showDeleteContact ? (
            <button type="button" className="cbtn-icon cbtn-icon--danger" title="Supprimer" aria-label="Supprimer" disabled={busy} onClick={() => void remove()}>
              🗑
            </button>
          ) : null}
          {showDeleteClient ? (
            <button type="button" className="cbtn-icon cbtn-icon--danger" title="Supprimer (ADMIN)" aria-label="Supprimer (ADMIN)" disabled={busy} onClick={() => void remove()}>
              🗑
            </button>
          ) : null}
          {showDeleteSite ? (
            <button type="button" className="cbtn-icon cbtn-icon--danger" title="Supprimer" aria-label="Supprimer" disabled={busy} onClick={() => void remove()}>
              🗑
            </button>
          ) : null}
        </>
      }
    >
      {kind === "contact" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

          {/* ── Identité ── */}
          <div className="crm-stack">
            <p className="crm-stack-title">
              <span className="crm-stack-title__icon" aria-hidden>◇</span> Identité
            </p>
            <div className="crm-form-grid crm-form-grid--tight">
              <label className="crm-field">
                <span className="crm-label">Civilité</span>
                {editing ? (
                  <select
                    className="crm-select"
                    value={form.civilite ?? "M."}
                    onChange={(e) => setForm((p) => ({ ...p, civilite: e.target.value }))}
                  >
                    <option value="M.">M.</option>
                    <option value="Mme">Mme</option>
                    <option value="Mlle">Mlle</option>
                  </select>
                ) : (
                  <input className="crm-input" readOnly value={form.civilite ?? ""} />
                )}
              </label>
              {field("prenom", "Prénom")}
              {field("nom", "Nom")}
              {field("fonction", "Fonction")}
              <label className="crm-field crm-span-2">
                <span className="crm-label">Entreprise / rattachement</span>
                <input
                  className="crm-input"
                  readOnly={!editing}
                  value={form.entreprise ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, entreprise: e.target.value }))}
                />
                <span className="crm-hint">Raison sociale ou groupe — détermine les sites et commandes associés.</span>
              </label>
            </div>
          </div>

          {/* ── Coordonnées ── */}
          <div className="crm-stack">
            <p className="crm-stack-title">
              <span className="crm-stack-title__icon" aria-hidden>@</span> Coordonnées
            </p>
            <div className="crm-form-grid crm-form-grid--tight">
              <label className="crm-field crm-span-2">
                <span className="crm-label">Email</span>
                <input
                  className="crm-input"
                  type="email"
                  readOnly={!editing}
                  value={form.email ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                />
                <span className="crm-hint">Utilisé comme identifiant de connexion à l'Espace Client.</span>
              </label>
              {field("telephone", "Téléphone fixe")}
              {field("mobile", "Mobile")}
            </div>
          </div>

          {/* ── Espace Client ── */}
          <div className="crm-stack">
            <p className="crm-stack-title">
              <span className="crm-stack-title__icon" aria-hidden>🔑</span> Accès Espace Client
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              {row.hasClientPassword ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#16a34a", fontWeight: 600, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "4px 12px" }}>
                  <span>✓</span> Mot de passe défini
                </span>
              ) : (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--g600)", background: "var(--g100)", border: "1px solid var(--g300)", borderRadius: 8, padding: "4px 12px" }}>
                  <span>—</span> Aucun mot de passe
                </span>
              )}
              <button
                type="button"
                className="cbtn cbtn-ghost cbtn-sm"
                disabled={clientPwdBusy}
                onClick={() => void resetClientPassword()}
              >
                {pwdBtnLabel(clientPwdBusy, Boolean(row.hasClientPassword))}
              </button>
            </div>

            {newPassword ? (
              <>
                <div style={{ background: "var(--g50)", border: "1px solid var(--g200)", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 14, fontWeight: 700, letterSpacing: 1, color: "var(--navy)", flex: 1 }}>
                    {newPassword}
                  </span>
                  <button
                    type="button"
                    className="cbtn cbtn-ghost cbtn-sm"
                    onClick={copyPassword}
                    title="Copier le mot de passe"
                  >
                    {pwdCopied ? "✓ Copié" : "Copier"}
                  </button>
                </div>
                <p className="crm-hint" style={{ marginTop: 8 }}>
                  Communiquez ce mot de passe provisoire au contact. Il pourra le modifier depuis son profil.
                </p>
              </>
            ) : (
              <p className="crm-hint">
                Communiquez ce mot de passe au contact pour qu'il accède à son Espace Client sur{" "}
                <strong>/espace-client/login</strong>.
              </p>
            )}
          </div>

          {row.ownerUserId != null ? (
            <p className="crm-hint" style={{ borderTop: "1px solid var(--g200)", paddingTop: 12 }}>
              Consultant assigné — id utilisateur : {`${row.ownerUserId}`}
            </p>
          ) : null}
        </div>
      ) : null}

      {kind === "client" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div className="crm-stack">
            <p className="crm-stack-title">
              <span className="crm-stack-title__icon" aria-hidden>◎</span> Identité
            </p>
            <div className="crm-form-grid crm-form-grid--tight">
              {field("raisonSociale", "Raison sociale")}
              {field("entite", "Entité")}
              {field("siret", "SIRET")}
            </div>
          </div>
          <div className="crm-stack">
            <p className="crm-stack-title">
              <span className="crm-stack-title__icon" aria-hidden>@</span> Coordonnées
            </p>
            <div className="crm-form-grid crm-form-grid--tight">
              {field("email", "Email")}
              {field("telephone", "Téléphone")}
              {field("codePostal", "Code postal")}
              <label className="crm-field crm-span-2">
                <span className="crm-label">Responsable client (email / contact)</span>
                <input
                  className="crm-input"
                  value={form.responsableEmail ?? ""}
                  readOnly={!editing}
                  onChange={(e) => setForm((prev) => ({ ...prev, responsableEmail: e.target.value }))}
                />
              </label>
              <p className="crm-hint crm-span-2">
                Modification du SIRET et de l’email est journalisée côté serveur (audit).
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {kind === "site" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div className="crm-stack">
            <p className="crm-stack-title">
              <span className="crm-stack-title__icon" aria-hidden>▣</span> Identité du site
            </p>
            <div className="crm-form-grid crm-form-grid--tight">
              {field("nom", "Nom du site")}
              {field("typeSite", "Type")}
              {field("clientNom", "Client propriétaire")}
              <div className="crm-field crm-span-2">
                <span className="crm-label">Statut</span>
                <select
                  className="crm-select"
                  disabled={!editing}
                  value={form.statut ?? "ACTIF"}
                  onChange={(e) => setForm((prev) => ({ ...prev, statut: e.target.value }))}
                >
                  <option value="ACTIF">Actif (visible dans les listes)</option>
                  <option value="ARCHIVE">Archivé (masqué des listes)</option>
                </select>
              </div>
            </div>
          </div>
          <SiteGestionnairesPanel siteId={id} onChanged={onSaved} />
          <SiteEquipementsPanel siteId={id} siteNom={form.nom} onChanged={onSaved} />
          <SiteArborescencePanel siteId={id} siteNom={form.nom} />
        </div>
      ) : null}
    </CrmEntityModal>
  );
}
