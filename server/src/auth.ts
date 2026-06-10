import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "lvo-dev-jwt-secret-change-in-production";
const ACCESS_TTL = "15m";
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
