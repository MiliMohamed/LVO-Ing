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

export function Phase5EntitySheet({ open, kind, path, row, onClose, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open || !row) return;
    setEditing(false);
    setLocalErr(null);
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
            <button type="button" className="cbtn cbtn-primary" onClick={() => setEditing(true)}>
              Modifier
            </button>
          ) : (
            <>
              <button type="button" className="cbtn cbtn-primary" disabled={busy} onClick={() => void save()}>
                Enregistrer
              </button>
              <button type="button" className="cbtn cbtn-ghost" disabled={busy} onClick={() => setEditing(false)}>
                Annuler l’édition
              </button>
            </>
          )}
          {showDeleteContact ? (
            <button type="button" className="cbtn cbtn-danger" disabled={busy} onClick={() => void remove()}>
              Supprimer
            </button>
          ) : null}
          {showDeleteClient ? (
            <button type="button" className="cbtn cbtn-danger" disabled={busy} onClick={() => void remove()}>
              Supprimer (ADMIN)
            </button>
          ) : null}
          {showDeleteSite ? (
            <button type="button" className="cbtn cbtn-danger" disabled={busy} onClick={() => void remove()}>
              Supprimer
            </button>
          ) : null}
        </>
      }
    >
      {kind === "contact" ? (
        <div className="crm-form-grid crm-form-grid--tight">
          {field("civilite", "Civilité")}
          {field("prenom", "Prénom")}
          {field("nom", "Nom")}
          {field("entreprise", "Entreprise / rattachement")}
          {field("fonction", "Fonction")}
          {field("email", "Email")}
          {field("telephone", "Téléphone")}
          {field("mobile", "Mobile")}
          {row.ownerUserId != null ? (
            <p className="crm-hint crm-span-2">
              Consultant assigné (id utilisateur) : {String(row.ownerUserId)}
            </p>
          ) : null}
        </div>
      ) : null}

      {kind === "client" ? (
        <div className="crm-form-grid crm-form-grid--tight">
          {field("raisonSociale", "Raison sociale")}
          {field("entite", "Entité")}
          {field("email", "Email")}
          {field("telephone", "Téléphone")}
          {field("siret", "SIRET")}
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
      ) : null}

      {kind === "site" ? (
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
          <div className="crm-span-2">
            <SiteGestionnairesPanel siteId={id} onChanged={onSaved} />
          </div>
          <div className="crm-span-2">
            <SiteEquipementsPanel siteId={id} siteNom={form.nom} onChanged={onSaved} />
          </div>
          <div className="crm-span-2">
            <SiteArborescencePanel siteId={id} siteNom={form.nom} />
          </div>
        </div>
      ) : null}
    </CrmEntityModal>
  );
}
