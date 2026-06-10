import type { NextFunction, Request, Response } from "express";

import { verifyAccessToken } from "./auth.js";

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
