import nodemailer from "nodemailer";

import { users, contacts, ascensoristes, crmAppSettings } from "../store.js";

let transporter: nodemailer.Transporter | null | undefined;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter !== undefined) return transporter;
  const host = process.env.SMTP_HOST;
  if (!host) {
    transporter = null;
    return transporter;
  }
  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  return transporter;
}

/** Envoie un email. N'échoue jamais bruyamment : sans SMTP configuré, l'envoi est simplement logué. */
export async function sendMail(opts: { to: string | (string | null | undefined)[]; subject: string; html: string }): Promise<void> {
  const to = (Array.isArray(opts.to) ? opts.to : [opts.to]).filter((v): v is string => Boolean(v));
  if (to.length === 0) return;

  const t = getTransporter();
  if (!t) {
    console.log(`[mailer] (SMTP non configuré, email non envoyé) À: ${to.join(", ")} — Sujet: ${opts.subject}`);
    return;
  }
  try {
    await t.sendMail({
      from: process.env.MAIL_FROM || "LVO Ingénierie <notifications@lvo-ing.fr>",
      to: to.join(", "),
      subject: opts.subject,
      html: opts.html,
    });
  } catch (e) {
    console.warn("[mailer] Échec d'envoi :", (e as Error).message);
  }
}

/** Emails des comptes CRM ADMIN — avec repli sur l'email consultant par défaut. */
export function getAdminEmails(): string[] {
  const emails = users.filter((u) => u.role === "ADMIN" && u.email).map((u) => u.email);
  return emails.length > 0 ? emails : [crmAppSettings.defaultConsultantEmail];
}

/** Emails des contacts actifs d'un client (par raison sociale). */
export function getClientEmails(clientNom: string): string[] {
  return contacts.filter((c) => c.entreprise === clientNom && c.statut === "ACTIF" && c.email).map((c) => c.email);
}

/** Email de l'ascensoriste correspondant à un identifiant. */
export function getAscensoristeEmail(ascensoristeId: number | null | undefined): string | null {
  if (ascensoristeId == null) return null;
  return ascensoristes.find((a) => a.id === ascensoristeId)?.email ?? null;
}

/** Habillage HTML minimal commun à toutes les notifications. */
export function renderMailHtml(title: string, bodyHtml: string): string {
  return `<div style="font-family: Arial, sans-serif; color:#1f2937; max-width:560px;">
    <h2 style="color:#0f2a4a; font-size:18px; margin-bottom:14px;">${title}</h2>
    <div style="font-size:14px; line-height:1.6;">${bodyHtml}</div>
    <p style="font-size:11px; color:#9ca3af; margin-top:24px;">LVO Ingénierie — notification automatique, ne pas répondre à cet email.</p>
  </div>`;
}
