"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchUserAvatarBlob,
  fetchUserProfile,
  profileDisplayName,
  profileInitials,
} from "@/lib/profile-api";
import { normalizeRole, roleBadgeLabel } from "@/lib/rbac";
import type { UserProfile } from "@/lib/types";
import { readEmail, readRole } from "@/lib/token-storage";

type Props = {
  onLogout: () => void;
};

export function CrmUserMenu({ onLogout }: Props) {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const role = normalizeRole(readRole());
  const email = readEmail() ?? "";

  const loadProfile = useCallback(async () => {
    try {
      const p = await fetchUserProfile();
      setProfile(p);
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
    function onUpdated() {
      void loadProfile();
    }
    window.addEventListener("lvo-profile-updated", onUpdated);
    return () => window.removeEventListener("lvo-profile-updated", onUpdated);
  }, [loadProfile]);

  useEffect(() => {
    let revoke: string | null = null;
    let cancel = false;

    void (async () => {
      if (!profile?.hasAvatar) {
        setAvatarUrl(null);
        return;
      }
      const blob = await fetchUserAvatarBlob();
      if (cancel || !blob) return;
      revoke = URL.createObjectURL(blob);
      setAvatarUrl(revoke);
    })();

    return () => {
      cancel = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [profile?.hasAvatar, profile?.id]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const label = profile ? profileDisplayName(profile) : email;
  const initials = profile
    ? profileInitials(profile)
    : profileInitials({ prenom: null, nom: null, email });

  return (
    <div className="ctb-user-menu" ref={rootRef}>
      <button
        type="button"
        className="ctb-user-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ctb-user-avatar" aria-hidden>
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="ctb-user-avatar-img" />
          ) : (
            initials
          )}
        </span>
        <span className="ctb-user-name hidden md:inline">{label}</span>
        <span className="ctb-user-chevron" aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <div className="ctb-user-dropdown" role="menu">
          <div className="ctb-user-dropdown-hdr">
            <span className="ctb-user-dropdown-avatar" aria-hidden>
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="ctb-user-avatar-img" />
              ) : (
                initials
              )}
            </span>
            <div className="min-w-0">
              <p className="ctb-user-dropdown-name">{label}</p>
              <p className="ctb-user-dropdown-email">{profile?.email ?? email}</p>
              <span className="ctb-user-dropdown-role">{roleBadgeLabel(role)}</span>
            </div>
          </div>
          <Link
            href="/crm/profil"
            className="ctb-user-dropdown-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Mon profil
          </Link>
          <button
            type="button"
            className="ctb-user-dropdown-item ctb-user-dropdown-item--danger"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            Déconnexion
          </button>
        </div>
      ) : null}
    </div>
  );
}
