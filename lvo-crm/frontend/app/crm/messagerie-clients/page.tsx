"use client";

import { useEffect, useRef, useState } from "react";
import { getApiBaseUrl } from "@/lib/config";
import { readToken } from "@/lib/token-storage";

type Message = {
  id: number;
  threadId: string;
  senderType: "CLIENT" | "CRM";
  senderName: string;
  senderEmail: string;
  body: string;
  createdAt: string;
  readByCrm: boolean;
};

type Thread = {
  threadId: string;
  entreprise: string;
  subject: string;
  lastMessage: Message;
  messages: Message[];
  unreadCount: number;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

async function crmFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const base = getApiBaseUrl();
  const token = readToken();
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token ?? ""}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<T>;
}

export default function MessageriClientsPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [active, setActive] = useState<Thread | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const data = await crmFetch<Thread[]>("/api/messages-clients");
      setThreads(data);
      if (active) {
        const updated = data.find((t) => t.threadId === active.threadId);
        if (updated) setActive(updated);
      }
    } catch {
      setError("Impossible de charger les messages.");
    }
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [active?.messages.length]);

  async function openThread(t: Thread) {
    setActive(t);
    if (t.unreadCount > 0) {
      await crmFetch(`/api/messages-clients/${t.threadId}/read`, { method: "PATCH" }).catch(() => null);
      await load();
    }
  }

  async function sendReply() {
    if (!reply.trim() || !active) return;
    setSending(true);
    setError(null);
    try {
      await crmFetch(`/api/messages-clients/${active.threadId}/reply`, {
        method: "POST",
        body: JSON.stringify({ body: reply }),
      });
      setReply("");
      await load();
    } catch {
      setError("Erreur lors de l'envoi.");
    } finally {
      setSending(false);
    }
  }

  const totalUnread = threads.reduce((sum, t) => sum + t.unreadCount, 0);

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--navy)", marginBottom: 4 }}>
          Messagerie clients
        </h1>
        <p style={{ fontSize: 13, color: "var(--smoke)" }}>
          {threads.length} conversation{threads.length > 1 ? "s" : ""}
          {totalUnread > 0 && ` · ${totalUnread} non lue${totalUnread > 1 ? "s" : ""}`}
        </p>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", color: "#dc2626", marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16, minHeight: 560 }}>
        {/* Thread list */}
        <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--g100)", background: "var(--g50)" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--smoke)", textTransform: "uppercase", letterSpacing: 1 }}>Conversations</span>
          </div>
          {threads.length === 0 && (
            <div style={{ padding: 24, color: "var(--smoke)", fontSize: 13, textAlign: "center" }}>Aucun message client</div>
          )}
          {threads.map((t) => (
            <button
              key={t.threadId}
              onClick={() => openThread(t)}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "14px 16px", borderBottom: "1px solid var(--g100)", background: active?.threadId === t.threadId ? "#eff6ff" : "transparent", border: "none", cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <span style={{ fontWeight: t.unreadCount > 0 ? 700 : 500, fontSize: 13, color: "var(--navy)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.entreprise}
                </span>
                {t.unreadCount > 0 && (
                  <span style={{ background: "var(--orange)", color: "#fff", borderRadius: 99, fontSize: 10, padding: "1px 6px", fontWeight: 700 }}>
                    {t.unreadCount}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: "var(--smoke)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.subject}</div>
              <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>{t.lastMessage.senderName} · {formatDate(t.lastMessage.createdAt)}</div>
            </button>
          ))}
        </div>

        {/* Conversation panel */}
        <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 14, display: "flex", flexDirection: "column" }}>
          {!active ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--smoke)", fontSize: 14 }}>
              Sélectionnez une conversation
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--g100)", background: "var(--g50)" }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--navy)" }}>{active.subject}</div>
                <div style={{ fontSize: 12, color: "var(--smoke)", marginTop: 2 }}>
                  {active.entreprise} · {active.messages.length} message{active.messages.length > 1 ? "s" : ""}
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                {active.messages.map((m) => {
                  const isClient = m.senderType === "CLIENT";
                  return (
                    <div key={m.id} style={{ display: "flex", flexDirection: isClient ? "row" : "row-reverse", gap: 10, alignItems: "flex-end" }}>
                      <div style={{ width: 34, height: 34, borderRadius: "50%", background: isClient ? "#e5e7eb" : "var(--navy)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: isClient ? "var(--navy)" : "#fff", flexShrink: 0, fontWeight: 700 }}>
                        {isClient ? m.senderName[0]?.toUpperCase() : "L"}
                      </div>
                      <div style={{ maxWidth: "68%" }}>
                        <div style={{ fontSize: 11, color: "var(--smoke)", marginBottom: 3, textAlign: isClient ? "left" : "right" }}>
                          {m.senderName} · {formatDate(m.createdAt)}
                          {isClient && !m.readByCrm && <span style={{ marginLeft: 6, color: "var(--orange)", fontWeight: 700 }}>● non lu</span>}
                        </div>
                        <div style={{ background: isClient ? "var(--g50)" : "var(--navy)", color: isClient ? "var(--navy)" : "#fff", borderRadius: isClient ? "14px 14px 14px 4px" : "14px 14px 4px 14px", padding: "10px 14px", fontSize: 13, lineHeight: 1.55 }}>
                          {m.body}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {/* Reply box */}
              <div style={{ padding: "12px 16px", borderTop: "1px solid var(--g100)", display: "flex", gap: 8, background: "var(--g50)" }}>
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendReply(); } }}
                  rows={2}
                  placeholder="Répondre au client… (Entrée pour envoyer)"
                  style={{ flex: 1, border: "1px solid var(--g200)", borderRadius: 8, padding: "8px 12px", fontSize: 13, resize: "none", outline: "none", background: "#fff" }}
                />
                <button
                  onClick={sendReply}
                  disabled={sending || !reply.trim()}
                  style={{ background: "var(--navy)", color: "#fff", border: "none", borderRadius: 8, padding: "0 18px", fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: sending || !reply.trim() ? 0.5 : 1 }}
                >
                  {sending ? "…" : "Envoyer"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
