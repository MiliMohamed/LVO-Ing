import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "lvo-dev-jwt-secret-change-in-production";
const ACCESS_TTL = "24h";
const REFRESH_TTL_MS = 7 * 24 * 3600 * 1000;

/** refreshToken -> { userId, exp } */
export const refreshRegistry = new Map<string, { userId: number; exp: number }>();

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export function signAccessToken(payload: { sub: number; email: string; role: string }) {
  return jwt.sign({ ...payload, typ: "access" }, JWT_SECRET, { expiresIn: ACCESS_TTL });
}

export function verifyAccessToken(token: string): { sub: number; email: string; role: string } | null {
  try {
    const p = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload & { sub: number; email: string; role: string; typ?: string };
    if (p.typ !== "access") return null;
    return { sub: p.sub, email: p.email, role: p.role };
  } catch {
    return null;
  }
}

export function issueRefreshToken(userId: number) {
  const token = crypto.randomBytes(32).toString("hex");
  refreshRegistry.set(token, { userId, exp: Date.now() + REFRESH_TTL_MS });
  return token;
}

export function consumeRefreshToken(token: string | undefined): number | null {
  if (!token) return null;
  const row = refreshRegistry.get(token);
  if (!row || row.exp < Date.now()) {
    refreshRegistry.delete(token);
    return null;
  }
  refreshRegistry.delete(token);
  return row.userId;
}

export function revokeAllRefreshForUser(userId: number) {
  for (const [k, v] of refreshRegistry) {
    if (v.userId === userId) refreshRegistry.delete(k);
  }
}

export function exportRefreshRegistries() {
  return {
    crm:         Array.from(refreshRegistry.entries()),
    client:      Array.from(clientRefreshRegistry.entries()),
    ascensoriste: Array.from(ascensoristeRefreshRegistry.entries()),
    exploitation: Array.from(exploitationRefreshRegistry.entries()),
  };
}

export function importRefreshRegistries(data: {
  crm:    [string, { userId: number; exp: number }][];
  client: [string, { contactId: number; exp: number }][];
  ascensoriste?: [string, { ascensoristeId: number; exp: number }][];
  exploitation?: [string, { exploitationUserId: number; exp: number }][];
}) {
  const now = Date.now();
  for (const [token, entry] of data.crm ?? []) {
    if (entry.exp > now) refreshRegistry.set(token, entry);
  }
  for (const [token, entry] of data.client ?? []) {
    if (entry.exp > now) clientRefreshRegistry.set(token, entry);
  }
  for (const [token, entry] of data.ascensoriste ?? []) {
    if (entry.exp > now) ascensoristeRefreshRegistry.set(token, entry);
  }
  for (const [token, entry] of data.exploitation ?? []) {
    if (entry.exp > now) exploitationRefreshRegistry.set(token, entry);
  }
}

/** Client portal — refresh token registry (séparé des users CRM) */
export const clientRefreshRegistry = new Map<string, { contactId: number; exp: number }>();

export function signClientAccessToken(payload: { sub: number; email: string }) {
  return jwt.sign({ ...payload, role: "CLIENT", typ: "client_access" }, JWT_SECRET, { expiresIn: ACCESS_TTL });
}

export function verifyClientAccessToken(token: string): { sub: number; email: string } | null {
  try {
    const p = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload & { sub: number; email: string; typ?: string };
    if (p.typ !== "client_access") return null;
    return { sub: p.sub, email: p.email };
  } catch {
    return null;
  }
}

export function issueClientRefreshToken(contactId: number) {
  const token = crypto.randomBytes(32).toString("hex");
  clientRefreshRegistry.set(token, { contactId, exp: Date.now() + REFRESH_TTL_MS });
  return token;
}

export function consumeClientRefreshToken(token: string | undefined): number | null {
  if (!token) return null;
  const row = clientRefreshRegistry.get(token);
  if (!row || row.exp < Date.now()) {
    clientRefreshRegistry.delete(token);
    return null;
  }
  clientRefreshRegistry.delete(token);
  return row.contactId;
}

/** Espace ascensoriste — refresh token registry (séparé des users CRM et des clients) */
export const ascensoristeRefreshRegistry = new Map<string, { ascensoristeId: number; exp: number }>();

export function signAscensoristeAccessToken(payload: { sub: number; email: string }) {
  return jwt.sign({ ...payload, role: "ASCENSORISTE", typ: "ascensoriste_access" }, JWT_SECRET, { expiresIn: ACCESS_TTL });
}

export function verifyAscensoristeAccessToken(token: string): { sub: number; email: string } | null {
  try {
    const p = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload & { sub: number; email: string; typ?: string };
    if (p.typ !== "ascensoriste_access") return null;
    return { sub: p.sub, email: p.email };
  } catch {
    return null;
  }
}

export function issueAscensoristeRefreshToken(ascensoristeId: number) {
  const token = crypto.randomBytes(32).toString("hex");
  ascensoristeRefreshRegistry.set(token, { ascensoristeId, exp: Date.now() + REFRESH_TTL_MS });
  return token;
}

export function consumeAscensoristeRefreshToken(token: string | undefined): number | null {
  if (!token) return null;
  const row = ascensoristeRefreshRegistry.get(token);
  if (!row || row.exp < Date.now()) {
    ascensoristeRefreshRegistry.delete(token);
    return null;
  }
  ascensoristeRefreshRegistry.delete(token);
  return row.ascensoristeId;
}

/** Admin Exploitation — refresh token registry (séparé des users CRM, clients et ascensoristes) */
export const exploitationRefreshRegistry = new Map<string, { exploitationUserId: number; exp: number }>();

export function signExploitationAccessToken(payload: { sub: number; email: string; role: string }) {
  return jwt.sign({ ...payload, typ: "exploitation_access" }, JWT_SECRET, { expiresIn: ACCESS_TTL });
}

export function verifyExploitationAccessToken(token: string): { sub: number; email: string; role: string } | null {
  try {
    const p = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload & { sub: number; email: string; role: string; typ?: string };
    if (p.typ !== "exploitation_access") return null;
    return { sub: p.sub, email: p.email, role: p.role };
  } catch {
    return null;
  }
}

export function issueExploitationRefreshToken(exploitationUserId: number) {
  const token = crypto.randomBytes(32).toString("hex");
  exploitationRefreshRegistry.set(token, { exploitationUserId, exp: Date.now() + REFRESH_TTL_MS });
  return token;
}

export function consumeExploitationRefreshToken(token: string | undefined): number | null {
  if (!token) return null;
  const row = exploitationRefreshRegistry.get(token);
  if (!row || row.exp < Date.now()) {
    exploitationRefreshRegistry.delete(token);
    return null;
  }
  exploitationRefreshRegistry.delete(token);
  return row.exploitationUserId;
}

export function generateDefaultPassword(nom: string): string {
  const part = (nom || "").replace(/[^a-zA-Z]/g, "").slice(0, 4).padEnd(4, "x");
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `Lvo@${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}${digits}`;
}
