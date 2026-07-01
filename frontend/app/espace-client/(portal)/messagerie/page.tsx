"use client";

import { useEffect, useRef, useState } from "react";
import { clientApiFetch, clientApiPost, clientApiPatch } from "@/lib/client-api";
import { readClientContact } from "@/lib/token-storage";

type Message = {
  id: number;
  threadId: string;
  senderType: "CLIENT" | "CRM";
  senderName: string;
  body: string;
  createdAt: string;
  readByClient: boolean;
};

type Thread = {
  threadId: string;
  subject: string;
  lastMessage: Message;
  messages: Message[];
  unreadCount: number;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function MessageriePage() {
  const contact = readClientContact();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [newSubject, setNewSubject] = useState("");
  const [body, setBody] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const data = await clientApiFetch<Thread[]>("/api/client/messages");
      setThreads(data);
      if (activeThread) {
        const updated = data.find((t) => t.threadId === activeThread.threadId);
        if (updated) setActiveThread(updated);
      }
    } catch {
      setError("Impossible de charger les messages.");
    }
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [activeThread?.messages.length]);

  async function openThread(thread: Thread) {
    setActiveThread(thread);
    setShowNew(false);
    if (thread.unreadCount > 0) {
      await clientApiPatch(`/api/client/messages/${thread.threadId}/read`).catch(() => null);
      await load();
    }
  }

  async function send() {
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    try {
      if (showNew) {
        const msg = await clientApiPost<Message>("/api/client/messages", { subject: newSubject || "Nouveau message", body });
        await load();
        const updated = threads.find((t) => t.threadId === msg.threadId);
        if (updated) setActiveThread(updated);
        setShowNew(false);
        setNewSubject("");
      } else if (activeThread) {
        await clientApiPost("/api/client/messages", { threadId: activeThread.threadId, body });
        await load();
      }
      setBody("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de l'envoi.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--navy)" }}>Messagerie</h1>
        <button
          onClick={() => { setShowNew(true); setActiveThread(null); setBody(""); setNewSubject(""); }}
          style={{ background: "var(--orange)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
        >
          + Nouveau message
        </button>
      </div>

      {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", color: "#dc2626", marginBottom: 16, fontSize: 13 }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16, minHeight: 500 }}>
        {/* Thread list */}
        <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 14, overflow: "hidden" }}>
          {threads.length === 0 && (
            <div style={{ padding: 24, color: "var(--smoke)", fontSize: 13, textAlign: "center" }}>Aucun message</div>
          )}
          {threads.map((t) => (
            <button
              key={t.threadId}
              onClick={() => openThread(t)}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "14px 16px", borderBottom: "1px solid var(--g100)", background: activeThread?.threadId === t.threadId ? "var(--g50)" : "transparent", border: "none", cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontWeight: t.unreadCount > 0 ? 700 : 500, fontSize: 13, color: "var(--navy)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.subject}</span>
                {t.unreadCount > 0 && (
                  <span style={{ background: "var(--orange)", color: "#fff", borderRadius: 99, fontSize: 10, padding: "1px 6px", fontWeight: 700 }}>{t.unreadCount}</span>
                )}
              </div>
              <div style={{ fontSize: 11, color: "var(--smoke)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.lastMessage.body.slice(0, 60)}</div>
              <div style={{ fontSize: 10, color: "#aaa", marginTop: 2 }}>{formatDate(t.lastMessage.createdAt)}</div>
            </button>
          ))}
        </div>

        {/* Conversation or new */}
        <div style={{ background: "#fff", border: "1px solid var(--g200)", borderRadius: 14, display: "flex", flexDirection: "column" }}>
          {!activeThread && !showNew && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--smoke)", fontSize: 14 }}>
              Sélectionnez une conversation ou créez-en une nouvelle.
            </div>
          )}

          {showNew && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 24 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--navy)", marginBottom: 20 }}>Nouveau message à LVO</div>
              <label style={{ fontSize: 12, color: "var(--smoke)", marginBottom: 4 }}>Objet</label>
              <input
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder="Ex. : Demande d'information sur l'offre MOE-26001"
                style={{ border: "1px solid var(--g200)", borderRadius: 8, padding: "9px 12px", fontSize: 13, marginBottom: 16, outline: "none" }}
              />
              <label style={{ fontSize: 12, color: "var(--smoke)", marginBottom: 4 }}>Message</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                style={{ border: "1px solid var(--g200)", borderRadius: 8, padding: "9px 12px", fontSize: 13, resize: "vertical", flex: 1, outline: "none" }}
                placeholder="Votre message…"
              />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12, gap: 8 }}>
                <button onClick={() => setShowNew(false)} style={{ background: "var(--g100)", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, cursor: "pointer" }}>Annuler</button>
                <button onClick={send} disabled={sending || !body.trim()} style={{ background: "var(--orange)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: sending || !body.trim() ? 0.6 : 1 }}>
                  {sending ? "Envoi…" : "Envoyer"}
                </button>
              </div>
            </div>
          )}

          {activeThread && (
            <>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--g100)" }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--navy)" }}>{activeThread.subject}</div>
                <div style={{ fontSize: 12, color: "var(--smoke)", marginTop: 2 }}>{activeThread.messages.length} message{activeThread.messages.length > 1 ? "s" : ""}</div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                {activeThread.messages.map((m) => {
                  const isClient = m.senderType === "CLIENT";
                  return (
                    <div key={m.id} style={{ display: "flex", flexDirection: isClient ? "row-reverse" : "row", gap: 10, alignItems: "flex-end" }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: isClient ? "var(--orange)" : "var(--navy)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#fff", flexShrink: 0 }}>
                        {isClient ? (contact?.prenom?.[0] ?? "C") : "L"}
                      </div>
                      <div style={{ maxWidth: "70%" }}>
                        <div style={{ fontSize: 11, color: "var(--smoke)", marginBottom: 4, textAlign: isClient ? "right" : "left" }}>
                          {m.senderName} · {formatDate(m.createdAt)}
                        </div>
                        <div style={{ background: isClient ? "var(--orange)" : "var(--g50)", color: isClient ? "#fff" : "var(--navy)", borderRadius: isClient ? "14px 14px 4px 14px" : "14px 14px 14px 4px", padding: "10px 14px", fontSize: 13, lineHeight: 1.5 }}>
                          {m.body}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
              <div style={{ padding: "12px 16px", borderTop: "1px solid var(--g100)", display: "flex", gap: 8 }}>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                  rows={2}
                  placeholder="Répondre… (Entrée pour envoyer)"
                  style={{ flex: 1, border: "1px solid var(--g200)", borderRadius: 8, padding: "8px 12px", fontSize: 13, resize: "none", outline: "none" }}
                />
                <button onClick={send} disabled={sending || !body.trim()} style={{ background: "var(--orange)", color: "#fff", border: "none", borderRadius: 8, padding: "0 18px", fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: sending || !body.trim() ? 0.6 : 1 }}>
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
