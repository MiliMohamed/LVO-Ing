"use client";

import { useCallback, useEffect, useState } from "react";

import {
  changeUserPassword,
  fetchUserAvatarBlob,
  fetchUserProfile,
  notifyProfileUpdated,
  profileDisplayName,
  profileInitials,
  removeUserAvatar,
  updateUserProfile,
  uploadUserAvatar,
} from "@/lib/profile-api";
import { normalizeRole, roleBadgeLabel } from "@/lib/rbac";
import type { UserProfile } from "@/lib/types";

export function ProfileClient() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshAvatar = useCallback(async (hasAvatar: boolean) => {
    setAvatarUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (!hasAvatar) return;
    const blob = await fetchUserAvatarBlob();
    if (blob) setAvatarUrl(URL.createObjectURL(blob));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const p = await fetchUserProfile();
      setProfile(p);
      setPrenom(p.prenom ?? "");
      setNom(p.nom ?? "");
      setTelephone(p.telephone ?? "");
      await refreshAvatar(p.hasAvatar);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Impossible de charger le profil");
    } finally {
      setLoading(false);
    }
  }, [refreshAvatar]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chargement initial
  }, []);

  useEffect(() => {
    return () => {
      if (avatarUrl) URL.revokeObjectURL(avatarUrl);
    };
  }, [avatarUrl]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const p = await updateUserProfile({ prenom, nom, telephone });
      setProfile(p);
      setMsg("Informations personnelles enregistrées.");
      notifyProfileUpdated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    if (newPassword !== confirmPassword) {
      setErr("La confirmation ne correspond pas au nouveau mot de passe.");
      return;
    }
    if (newPassword.length < 6) {
      setErr("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    setBusy(true);
    try {
      await changeUserPassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMsg("Mot de passe mis à jour.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function onAvatarSelected(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const p = await uploadUserAvatar(file);
      setProfile(p);
      await refreshAvatar(p.hasAvatar);
      setMsg("Photo de profil mise à jour.");
      notifyProfileUpdated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur upload");
    } finally {
      setBusy(false);
    }
  }

  async function onRemoveAvatar() {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const p = await removeUserAvatar();
      setProfile(p);
      if (avatarUrl) URL.revokeObjectURL(avatarUrl);
      setAvatarUrl(null);
      setMsg("Photo de profil supprimée.");
      notifyProfileUpdated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-neutral-600">Chargement du profil…</p>;
  }

  if (!profile) {
    return <p className="crm-alert crm-alert--error">{err ?? "Profil indisponible"}</p>;
  }

  const initials = profileInitials(profile);

  return (
    <>
      <header className="pg-hdr mb-4">
        <h1>Mon profil</h1>
        <p>Gérez vos informations personnelles, votre photo et votre mot de passe.</p>
      </header>

      {err ? <p className="crm-alert crm-alert--error">{err}</p> : null}
      {msg ? <p className="crm-alert crm-alert--info">{msg}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="fcard">
          <div className="fcard-hdr">
            <h2>Photo de profil</h2>
          </div>
          <div className="fcard-body space-y-4">
            <div className="profile-avatar-row">
              <span className="profile-avatar-lg" aria-hidden>
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="" className="profile-avatar-img" />
                ) : (
                  initials
                )}
              </span>
              <div className="space-y-2">
                <label className="crm-field block">
                  <span className="crm-label">Choisir une image</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="crm-input"
                    disabled={busy}
                    onChange={(e) => void onAvatarSelected(e.target.files?.[0])}
                  />
                </label>
                <p className="crm-hint">JPEG, PNG, WebP ou GIF — 2 Mo maximum.</p>
                {profile.hasAvatar ? (
                  <button
                    type="button"
                    className="cbtn cbtn-ghost cbtn-sm"
                    disabled={busy}
                    onClick={() => void onRemoveAvatar()}
                  >
                    Supprimer la photo
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="fcard">
          <div className="fcard-hdr">
            <h2>Compte</h2>
          </div>
          <div className="fcard-body space-y-2 text-sm">
            <p>
              <span className="text-neutral-500">E-mail : </span>
              <strong>{profile.email}</strong>
            </p>
            <p>
              <span className="text-neutral-500">Rôle : </span>
              <strong>{roleBadgeLabel(normalizeRole(profile.role))}</strong>
            </p>
            {profile.agenceNom ? (
              <p>
                <span className="text-neutral-500">Agence : </span>
                <strong>{profile.agenceNom}</strong>
              </p>
            ) : null}
            <p className="crm-hint pt-1">L&apos;e-mail est géré par l&apos;administrateur.</p>
          </div>
        </div>

        <div className="fcard lg:col-span-2">
          <div className="fcard-hdr">
            <h2>Informations personnelles</h2>
            <p className="fcard-hdr-sub">{profileDisplayName(profile)}</p>
          </div>
          <form className="fcard-body space-y-3" onSubmit={(e) => void saveProfile(e)}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="crm-field">
                <span className="crm-label">Prénom</span>
                <input
                  className="crm-input"
                  value={prenom}
                  disabled={busy}
                  onChange={(e) => setPrenom(e.target.value)}
                />
              </label>
              <label className="crm-field">
                <span className="crm-label">Nom</span>
                <input
                  className="crm-input"
                  value={nom}
                  disabled={busy}
                  onChange={(e) => setNom(e.target.value)}
                />
              </label>
              <label className="crm-field sm:col-span-2">
                <span className="crm-label">Téléphone</span>
                <input
                  className="crm-input"
                  type="tel"
                  value={telephone}
                  disabled={busy}
                  onChange={(e) => setTelephone(e.target.value)}
                />
              </label>
            </div>
            <button type="submit" className="cbtn cbtn-orange cbtn-sm" disabled={busy}>
              Enregistrer
            </button>
          </form>
        </div>

        <div className="fcard lg:col-span-2">
          <div className="fcard-hdr">
            <h2>Mot de passe</h2>
          </div>
          <form className="fcard-body space-y-3" onSubmit={(e) => void savePassword(e)}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="crm-field">
                <span className="crm-label">Mot de passe actuel</span>
                <input
                  className="crm-input"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  disabled={busy}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </label>
              <label className="crm-field">
                <span className="crm-label">Nouveau mot de passe</span>
                <input
                  className="crm-input"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  disabled={busy}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </label>
              <label className="crm-field">
                <span className="crm-label">Confirmer</span>
                <input
                  className="crm-input"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  disabled={busy}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </label>
            </div>
            <button type="submit" className="cbtn cbtn-orange cbtn-sm" disabled={busy}>
              Changer le mot de passe
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
