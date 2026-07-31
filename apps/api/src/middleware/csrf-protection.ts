// CSRF protection for mutating API routes.
// Verifies that the Origin (or Referer) header matches a trusted origin.
// Better Auth handles CSRF internally for /api/auth/* routes; this guards our API routes.
import type { NextFunction, Request, Response } from "express";

const MUTATING_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

function getTrustedOrigins(): string[] {
  const origins: string[] = ["http://localhost:5173", "http://localhost:3000"];
  const web = process.env["WEB_ORIGIN"];
  const cors = process.env["CORS_ORIGIN"];
  if (web) origins.push(web);
  if (cors) origins.push(cors);
  return [...new Set(origins)];
}

function extractOriginHost(header: string | undefined): string | null {
  if (!header) return null;
  try {
    return new URL(header).origin;
  } catch {
    return null;
  }
}

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Only enforce on mutating methods; safe methods (GET/HEAD/OPTIONS) pass through.
  // Better Auth handles CSRF for /api/auth/* itself.
  if (!MUTATING_METHODS.has(req.method)) {
    next();
    return;
  }

  const trusted = getTrustedOrigins();
  const originHeader = extractOriginHost(req.headers["origin"]);
  const refererHeader = extractOriginHost(req.headers["referer"]);
  const candidate = originHeader ?? refererHeader;

  // In test environment, skip CSRF (tests send requests directly to Express)
  if (process.env["NODE_ENV"] === "test") {
    next();
    return;
  }

  if (!candidate || !trusted.includes(candidate)) {
    res.status(403).json({ ok: false, error: "Forbidden: invalid origin", code: "FORBIDDEN" });
    return;
  }

  next();
}
