"use client";

import { useState } from "react";

import { CrmCreateButton } from "@/components/crm/CrmCreateButton";
import { apiFetch } from "@/lib/api";
import { readToken } from "@/lib/token-storage";

const TEMPLATES: Record<
  string,
  { subject: string; body: string; hint: string }
> = {
  OFFRE: {
    subject: "LVO — Transmission de notre offre commerciale",
    body: "Bonjour,\n\nVeuillez trouver ci-joint notre offre détaillée ainsi que les annexes techniques.\nRestant disponible pour tout complément.\n\nCordialement,\nLVO Ingénierie",
    hint: "Pièces jointes : PDF offre, planning indicatif.",
  },
  FACTURE: {
    subject: "LVO — Facture et modalités de règlement",
    body: "Bonjour,\n\nVeuillez trouver ci-joint notre facture au format convenu.\nEn cas de question sur le montant ou les références, contactez votre interlocuteur habituel.\n\nCordialement,\nLVO Ingénierie",
    hint: "Joindre PDF facture + RIB si nécessaire.",
  },
  RELANCE: {
    subject: "LVO — Relance concernant notre proposition",
    body: "Bonjour,\n\nNous nous permettons de vous relancer suite à notre dernier échange sur la mission évoquée.\nSeriez-vous disponible pour un point cette semaine ?\n\nCordialement,\nLVO Ingénierie",
    hint: "Relance douce — pas de PJ obligatoire.",
  },
  INVITATION: {
    subject: "LVO — Invitation visio / réunion projet",
    body: "Bonjour,\n\nVous êtes invité(e) à participer à une réunion de lancement / suivi projet.\nLe lien de visioconférence vous sera communiqué après confirmation.\n\nCordialement,\nLVO Ingénierie",
    hint: "Ajouter lien agenda ou fichier .ics en PJ (Phase 2+).",
  },
};

export default function EmailsToolsPage() {
  const [to, setTo] = useState("");
  const [templateCode, setTemplateCode] = useState<keyof typeof TEMPLATES>("OFFRE");
  const [subject, setSubject] = useState(TEMPLATES.OFFRE.subject);
  const [body, setBody] = useState(TEMPLATES.OFFRE.body);
  const [msg, setMsg] = useState<string | null>(null);

  function applyTemplate(code: keyof typeof TEMPLATES) {
    setTemplateCode(code);
    const t = TEMPLATES[code];
    setSubject(t.subject);
    setBody(t.body);
  }

  async function send() {
    setMsg(null);
    try {
      await apiFetch("/api/emails/send", {
        token: readToken(),
        method: "POST",
        body: JSON.stringify({ to, subject, body, templateCode }),
      });
      setMsg("Email mis en file d'envoi (mock broker). Connecter SMTP / SES / SendGrid pour production.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erreur");
    }
  }

  const hint = TEMPLATES[templateCode].hint;

  return (
    <>
      <header className="pg-hdr mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1>Messagerie</h1>
          <p>Modèles métiers — offre, facture, relance, invitation — avec pièces jointes à brancher sur le MTA.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CrmCreateButton slug="offre" />
          <CrmCreateButton slug="facture" />
        </div>
      </header>

      <div className="fcard">
        <div className="fcard-body space-y-3">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TEMPLATES) as (keyof typeof TEMPLATES)[]).map((k) => (
              <button
                key={k}
                type="button"
                className={`cbtn cbtn-sm ${templateCode === k ? "cbtn-orange" : "cbtn-ghost"}`}
                onClick={() => applyTemplate(k)}
              >
                {k}
              </button>
            ))}
          </div>
          <p className="crm-hint">{hint}</p>
          <label className="crm-field">
            <span className="crm-label">Destinataire</span>
            <input className="crm-input" type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="adresse@client.fr" />
          </label>
          <label className="crm-field">
            <span className="crm-label">Objet</span>
            <input className="crm-input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Objet du message" />
          </label>
          <label className="crm-field">
            <span className="crm-label">Corps du message</span>
            <textarea className="crm-textarea min-h-40" value={body} onChange={(e) => setBody(e.target.value)} />
          </label>
          <button type="button" className="cbtn cbtn-orange" onClick={() => void send()}>
            Envoyer (file d&apos;attente)
          </button>
          {msg ? <p className="fnote">{msg}</p> : null}
        </div>
      </div>
    </>
  );
}
