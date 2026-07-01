"use client";

import { useEffect, useState } from "react";
import { clientApiFetch, clientApiPost, clientApiPatch } from "@/lib/client-api";
import Link from "next/link";

type ClientNotif = {
  id: number;
  title: string;
  message: string;
  kind: string;
  href: string | null;
  read: boolean;
  createdAt: string;
};

const KIND_ICON: Record<string, string> = {
  MESSAGE: "💬",
  OFFRE_UPDATE: "📋",
  FACTURE: "🧾",
  DOCUMENT: "📄",
  INFO: "ℹ️",
};

const KIND_COLOR: Record<string, string> = {
  MESSAGE: "#2563eb",
  OFFRE_UPDATE: "#d97706",
  FACTURE: "#dc2626",
  DOCUMENT: "#7c3aed",
  INFO: "#6b7280",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState<ClientNotif[]>([]);
  const [unread, setUnread] = useState(0);

  async function load() {
    try {
      const data = await clientApiFetch<{ notifications: ClientNotif[]; unreadCount: number }>("/api/client/notifications");
      setNotifs(data.notifications);
      setUnread(data.unreadCount);
    } catch { /* ignore */ }
  }

  useEffect(() => { void load(); }, []);

  async function markRead(id: number) {
    await clientApiPatch(`/api/client/notifications/${id}/read`).catch(() => null);
    setNotifs((n) => n.map((x) => x.id === id ? { ...x, read: true } : x));
    setUnread((u) => Math.max(0, u - 1));
  }

  async function markAllRead() {
    await clientApiPost("/api/client/notifications/read-all", {}).catch(() => null);
    setNotifs((n) => n.map((x) => ({ ...x, read: true })));
    setUnread(0);
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--navy)" }}>Notifications</h1>
          {unread > 0 && <p style={{ fontSize: 13, color: "var(--smoke)", marginTop: 4 }}>{unread} non lue{unread > 1 ? "s" : ""}</p>}
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} style={{ background: "var(--g50)", border: "1px solid var(--g200)", borderRadius: 8, padding: "8px 14px", fontSize: 12, cursor: "pointer", color: "var(--navy)" }}>
            Tout marquer comme lu
          </button>
        )}
      </div>

      <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 14, overflow: "hidden" }}>
        {notifs.length === 0 && (
          <div style={{ padding: "60px 0", textAlign: "center", color: "var(--smoke)", fontSize: 14 }}>Aucune notification pour le moment.</div>
        )}
        {notifs.map((n) => (
          <div
            key={n.id}
            onClick={() => { if (!n.read) void markRead(n.id); }}
            style={{ display: "flex", gap: 14, padding: "16px 20px", borderBottom: "1px solid var(--g100)", background: n.read ? "#fff" : "#fffbf5", cursor: n.read ? "default" : "pointer", transition: "background 0.15s" }}
          >
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${KIND_COLOR[n.kind] ?? "#6b7280"}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
              {KIND_ICON[n.kind] ?? "🔔"}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <span style={{ fontWeight: n.read ? 500 : 700, fontSize: 13, color: "var(--navy)" }}>{n.title}</span>
                {!n.read && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--orange)", display: "inline-block" }} />}
              </div>
              <div style={{ fontSize: 13, color: "var(--smoke)", marginBottom: 4 }}>{n.message}</div>
              <div style={{ fontSize: 11, color: "#aaa" }}>{formatDate(n.createdAt)}</div>
              {n.href && (
                <Link href={n.href} style={{ fontSize: 12, color: "var(--orange)", fontWeight: 600, marginTop: 4, display: "inline-block" }}>
                  Voir →
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
