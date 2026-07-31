// Session validation middleware — rejects unauthenticated requests with 401.
// Attaches req.user and req.session (augmented via Express.Request interface).
import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth/auth-config";

/** Call Better Auth getSession and gate on session presence. */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session) {
      res.status(401).json({ ok: false, error: "Unauthorized", code: "UNAUTHORIZED" });
      return;
    }

    // Attach user/session so downstream handlers don't re-fetch
    req.user = session.user;
    req.session = session.session;
    next();
  } catch {
    res.status(401).json({ ok: false, error: "Unauthorized", code: "UNAUTHORIZED" });
  }
}
