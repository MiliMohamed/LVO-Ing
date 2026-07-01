import type { NextFunction, Request, Response } from "express";

import { verifyAccessToken, verifyExploitationAccessToken } from "./auth.js";

export type AuthedRequest = Request & { auth?: { userId: number; email: string; role: string } };

export function authMiddleware(req: AuthedRequest, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = h.slice(7);
  const p = verifyAccessToken(token);
  if (!p) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  req.auth = { userId: p.sub, email: p.email, role: p.role };
  next();
}

/**
 * Accepte soit un token CRM (Admin CRM), soit un token Admin Exploitation — uniquement
 * pour les chemins listés dans `allowedPrefixes` (ou tous les chemins si la liste contient "").
 * Le rôle Exploitation est mappé sur un rôle CRM équivalent pour rester compatible avec requireRoles().
 */
export function crmOrExploitationMiddleware(allowedPrefixes: string[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const h = req.headers.authorization;
    const token = h?.startsWith("Bearer ") ? h.slice(7) : "";

    const crmPayload = token ? verifyAccessToken(token) : null;
    if (crmPayload) {
      req.auth = { userId: crmPayload.sub, email: crmPayload.email, role: crmPayload.role };
      next();
      return;
    }

    const exploitationAutorise = allowedPrefixes.some((prefix) => req.path.startsWith(prefix));
    if (exploitationAutorise) {
      const exploitationPayload = token ? verifyExploitationAccessToken(token) : null;
      if (exploitationPayload) {
        req.auth = {
          userId: exploitationPayload.sub,
          email: exploitationPayload.email,
          role: exploitationPayload.role === "ADMIN_EXPLOITATION" ? "ADMIN" : "CONSULTANT",
        };
        next();
        return;
      }
    }

    res.status(401).json({ error: "Unauthorized" });
  };
}

export function requireRoles(...roles: string[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.auth) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!roles.includes(req.auth.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}
