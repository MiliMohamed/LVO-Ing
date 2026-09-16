"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { apiFetch } from "@/lib/api";
import type { CrmNotificationRow, CrmNotificationsResponse } from "@/lib/types";
import { readToken } from "@/lib/token-storage";

const KIND_ICON: Record<string, string> = {
  TASK_DUE: "⏰",
  OFFRE_RELANCE: "📋",
  FACTURE_RETARD: "💰",
  INFO: "ℹ️",
};

function fmtTime(iso: string) {
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function NotificationBell() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CrmNotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const token = readToken();
    if (!token) return;
    setLoading(true);
    try {
      const data = (await apiFetch("/api/notifications", { token })) as CrmNotificationsResponse | null;
      setItems(Array.isArray(data?.items) ? data.items.slice(0, 8) : []);
      setUnreadCount(typeof data?.unreadCount === "number" ? data.unreadCount : 0);
    } catch {
      setItems([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    void load();
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
  }, [open, load]);

  async function markRead(id: number) {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { token: readToken(), method: "PATCH" });
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      /* ignore */
    }
  }

  async function markAllRead() {
    try {
      await apiFetch("/api/notifications/read-all", { token: readToken(), method: "POST" });
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      /* ignore */
    }
  }

  async function openItem(n: CrmNotificationRow) {
    if (!n.read) await markRead(n.id);
    setOpen(false);
    if (n.href) router.push(n.href);
  }

  const badge = unreadCount > 99 ? "99+" : unreadCount > 0 ? String(unreadCount) : null;

  return (
    <div className="ctb-notif" ref={rootRef}>
      <button
        type="button"
        className="ctb-notif-trigger"
        aria-label={`Notifications${badge ? ` (${badge} non lues)` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ctb-notif-icon" aria-hidden>
          🔔
        </span>
        {badge ? <span className="ctb-notif-badge">{badge}</span> : null}
      </button>

      {open ? (
        <div className="ctb-notif-panel" role="dialog" aria-label="Notifications">
          <div className="ctb-notif-head">
            <span className="ctb-notif-title">Notifications</span>
            {unreadCount > 0 ? (
              <button type="button" className="ctb-notif-mark-all" onClick={() => void markAllRead()}>
                Tout marquer lu
              </button>
            ) : null}
          </div>
          {loading && items.length === 0 ? (
            <p className="ctb-notif-empty">Chargement…</p>
          ) : items.length === 0 ? (
            <p className="ctb-notif-empty">Aucune notification.</p>
          ) : (
            <ul className="ctb-notif-list">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`ctb-notif-item${n.read ? "" : " ctb-notif-item--unread"}`}
                    onClick={() => void openItem(n)}
                  >
                    <span className="ctb-notif-kind" aria-hidden>
                      {KIND_ICON[n.kind] ?? "•"}
                    </span>
                    <span className="ctb-notif-body">
                      <span className="ctb-notif-item-title">{n.title}</span>
                      <span className="ctb-notif-item-msg">{n.message}</span>
                      <span className="ctb-notif-item-time">{fmtTime(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="ctb-notif-foot">
            <Link href="/crm/notifications" className="ctb-notif-all" onClick={() => setOpen(false)}>
              Voir tout →
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
