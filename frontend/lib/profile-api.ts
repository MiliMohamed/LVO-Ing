import { apiFetch, apiFetchBlob } from "@/lib/api";
import type { UserProfile } from "@/lib/types";
import { readToken } from "@/lib/token-storage";

export function profileDisplayName(p: Pick<UserProfile, "prenom" | "nom" | "email">): string {
  const full = [p.prenom, p.nom].filter(Boolean).join(" ").trim();
  return full || p.email;
}

export function profileInitials(p: Pick<UserProfile, "prenom" | "nom" | "email">): string {
  if (p.prenom && p.nom) return `${p.prenom[0]}${p.nom[0]}`.toUpperCase();
  if (p.prenom) return p.prenom.slice(0, 2).toUpperCase();
  if (p.nom) return p.nom.slice(0, 2).toUpperCase();
  const local = p.email.split("@")[0] ?? "";
  return (local.slice(0, 2) || "??").toUpperCase();
}

export function notifyProfileUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("lvo-profile-updated"));
  }
}

export async function fetchUserProfile(token = readToken()): Promise<UserProfile> {
  return (await apiFetch("/api/me", { token })) as UserProfile;
}

export async function updateUserProfile(
  data: { prenom?: string; nom?: string; telephone?: string },
  token = readToken(),
): Promise<UserProfile> {
  return (await apiFetch("/api/me/profile", {
    method: "PATCH",
    token,
    body: JSON.stringify(data),
  })) as UserProfile;
}

export async function changeUserPassword(
  currentPassword: string,
  newPassword: string,
  token = readToken(),
): Promise<void> {
  await apiFetch("/api/me/password", {
    method: "POST",
    token,
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function uploadUserAvatar(file: File, token = readToken()): Promise<UserProfile> {
  const form = new FormData();
  form.append("file", file);
  return (await apiFetch("/api/me/avatar", { method: "POST", token, body: form })) as UserProfile;
}

export async function removeUserAvatar(token = readToken()): Promise<UserProfile> {
  return (await apiFetch("/api/me/avatar", { method: "DELETE", token })) as UserProfile;
}

export async function fetchUserAvatarBlob(token = readToken()): Promise<Blob | null> {
  try {
    return await apiFetchBlob("/api/me/avatar", { token });
  } catch {
    return null;
  }
}
