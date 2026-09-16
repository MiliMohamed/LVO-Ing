/**
 * Sessions d'édition ONLYOFFICE pour un document d'offre — un jeton opaque par session sert à la
 * fois d'identifiant et d'authentification pour les deux endpoints appelés par le conteneur
 * Document Server (qui ne peut pas envoyer de Bearer token CRM), montés sous /api/webhooks/onlyoffice/.
 */
import { randomUUID } from "node:crypto";

export type OffreEditSession = {
  token: string;
  offreId: number;
  version: number;
  numeroOffre: string;
  createdAt: number;
};

const sessions = new Map<string, OffreEditSession>();

/** Le conteneur ne peut pas résoudre localhost (ça pointerait vers lui-même) — il doit
 * atteindre Express via l'hôte Docker. Le navigateur, lui, utilise NEXT_PUBLIC_ONLYOFFICE_URL
 * (différent) pour charger le script éditeur et l'iframe. */
const CALLBACK_BASE_URL = process.env.ONLYOFFICE_CALLBACK_BASE_URL ?? "http://host.docker.internal:8080";

export function createEditSession(offreId: number, version: number, numeroOffre: string): OffreEditSession {
  const token = randomUUID();
  const session: OffreEditSession = { token, offreId, version, numeroOffre, createdAt: Date.now() };
  sessions.set(token, session);
  return session;
}

export function getEditSession(token: string): OffreEditSession | undefined {
  return sessions.get(token);
}

export function deleteEditSession(token: string): void {
  sessions.delete(token);
}

export function buildEditorConfig(session: OffreEditSession, userLabel: string) {
  const filename = `${session.numeroOffre}.docx`;
  return {
    documentType: "word",
    document: {
      fileType: "docx",
      key: session.token,
      title: filename,
      url: `${CALLBACK_BASE_URL}/api/webhooks/onlyoffice/${session.token}/source`,
    },
    editorConfig: {
      mode: "edit",
      callbackUrl: `${CALLBACK_BASE_URL}/api/webhooks/onlyoffice/${session.token}/callback`,
      user: { id: userLabel, name: userLabel },
      lang: "fr",
    },
  };
}
