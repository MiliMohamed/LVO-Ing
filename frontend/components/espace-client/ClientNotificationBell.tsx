"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { clientApiFetch, clientApiPost } from "@/lib/client-api";

type ClientNotif = {
  id: number;
  title: string;
  message: string;
  kind: string;
  href: string | null;
  read: boolean;
  createdAt: string;
};

const KIND_ICON: Record<string, string> = { MESSAGE: "💬", OFFRE_UPDATE: "📋", FACTURE: "🧾", DOCUMENT: "📄", INFO: "ℹ️" };

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function ClientNotificationBell() {
  const [unread, setUnread] = useState(0);
  const [notifs, setNotifs] = useState<ClientNotif[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const data = await clientApiFetch<{ notifications: ClientNotif[]; unreadCount: number }>("/api/client/notifications");
      setNotifs(data.notifications.slice(0, 8));
      setUnread(data.unreadCount);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function markAll() {
    await clientApiPost("/api/client/notifications/read-all", {}).catch(() => null);
    setNotifs((n) => n.map((x) => ({ ...x, read: true })));
    setUnread(0);
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ background: "transparent", border: "none", cursor: "pointer", position: "relative", fontSize: 20, color: "rgba(255,255,255,0.8)", padding: "4px 6px" }}
        title="Notifications"
      >
        🔔
        {unread > 0 && (
          <span style={{ position: "absolute", top: 0, right: 0, background: "var(--orange)", color: "#fff", borderRadius: 99, fontSize: 9, padding: "1px 4px", fontWeight: 700, lineHeight: 1.4 }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 320, background: "#fff", borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.15)", border: "1px solid var(--g200)", zIndex: 1000, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--g100)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: "var(--navy)" }}>Notifications {unread > 0 && `(${unread})`}</span>
            {unread > 0 && (
              <button onClick={markAll} style={{ background: "none", border: "none", fontSize: 11, color: "var(--orange)", cursor: "pointer", fontWeight: 600 }}>Tout lire</button>
            )}
          </div>
          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            {notifs.length === 0 && (
              <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--smoke)", fontSize: 13 }}>Aucune notification</div>
            )}
            {notifs.map((n) => (
              <div key={n.id} style={{ display: "flex", gap: 10, padding: "10px 14px", borderBottom: "1px solid var(--g100)", background: n.read ? "#fff" : "#fffbf5" }}>
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{KIND_ICON[n.kind] ?? "🔔"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: n.read ? 500 : 700, fontSize: 12, color: "var(--navy)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</div>
                  <div style={{ fontSize: 11, color: "var(--smoke)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.message}</div>
                  <div style={{ fontSize: 10, color: "#aaa", marginTop: 1 }}>{formatDate(n.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: "10px 16px", borderTop: "1px solid var(--g100)", textAlign: "center" }}>
            <Link href="/espace-client/notifications" onClick={() => setOpen(false)} style={{ fontSize: 12, color: "var(--orange)", fontWeight: 600 }}>
              Voir toutes les notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
