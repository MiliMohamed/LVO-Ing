"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import type { CrmNotificationRow, CrmNotificationsResponse } from "@/lib/types";
import { readToken } from "@/lib/token-storage";

const KIND_LABEL: Record<string, string> = {
  TASK_DUE: "Tâche",
  OFFRE_RELANCE: "Offre",
  FACTURE_RETARD: "Recouvrement",
  INFO: "Info",
};

function fmtTime(iso: string) {
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function NotificationsClient() {
  const router = useRouter();
  const [items, setItems] = useState<CrmNotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = (await apiFetch("/api/notifications", { token: readToken() })) as CrmNotificationsResponse | null;
      setItems(Array.isArray(data?.items) ? data.items : []);
      setUnreadCount(typeof data?.unreadCount === "number" ? data.unreadCount : 0);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function markRead(id: number) {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { token: readToken(), method: "PATCH" });
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function markAllRead() {
    try {
      await apiFetch("/api/notifications/read-all", { token: readToken(), method: "POST" });
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function openItem(n: CrmNotificationRow) {
    if (!n.read) await markRead(n.id);
    if (n.href) router.push(n.href);
  }

  const visible = filter === "unread" ? items.filter((n) => !n.read) : items;

  return (
    <>
      <div className="crm-page-head">
        <div>
          <h1 className="crm-page-title">Notifications</h1>
          <p className="crm-page-sub">
            Alertes métier — tâches en retard, offres sans réponse, factures impayées.
            {unreadCount > 0 ? ` ${unreadCount} non lue${unreadCount > 1 ? "s" : ""}.` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {unreadCount > 0 ? (
            <button type="button" className="cbtn cbtn-ghost" onClick={() => void markAllRead()}>
              Tout marquer lu
            </button>
          ) : null}
          <Link href="/crm/accueil" className="cbtn cbtn-ghost">
            ← Accueil
          </Link>
        </div>
      </div>

      <div className="ccard mb-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`cbtn cbtn-sm${filter === "all" ? " cbtn-primary" : " cbtn-ghost"}`}
            onClick={() => setFilter("all")}
          >
            Toutes ({items.length})
          </button>
          <button
            type="button"
            className={`cbtn cbtn-sm${filter === "unread" ? " cbtn-primary" : " cbtn-ghost"}`}
            onClick={() => setFilter("unread")}
          >
            Non lues ({unreadCount})
          </button>
        </div>
      </div>

      {err ? <p className="crm-alert crm-alert--error mb-4">{err}</p> : null}

      <div className="ccard">
        {loading ? (
          <p className="text-sm text-neutral-600">Chargement…</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-neutral-600">
            {filter === "unread" ? "Aucune notification non lue." : "Aucune notification pour le moment."}
          </p>
        ) : (
          <ul className="notif-page-list">
            {visible.map((n) => (
              <li key={n.id} className={`notif-page-item${n.read ? "" : " notif-page-item--unread"}`}>
                <button type="button" className="notif-page-item-btn" onClick={() => void openItem(n)}>
                  <span className="notif-page-kind">{KIND_LABEL[n.kind] ?? n.kind}</span>
                  <span className="notif-page-title">{n.title}</span>
                  <span className="notif-page-msg">{n.message}</span>
                  <span className="notif-page-time">{fmtTime(n.createdAt)}</span>
                </button>
                {!n.read ? (
                  <button type="button" className="cbtn cbtn-ghost cbtn-sm" onClick={() => void markRead(n.id)}>
                    Marquer lu
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
