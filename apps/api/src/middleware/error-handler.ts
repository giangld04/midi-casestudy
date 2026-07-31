// Global error handler — converts thrown errors into the consistent JSON
// envelope { ok:false, error, code }. Maps Zod, AppError, and Postgres
// constraint violations to their appropriate HTTP status codes.
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../lib/errors";

/** Shape returned for any error response */
interface ErrorBody {
  ok: false;
  error: string;
  code: string;
  details?: unknown;
}

/** Postgres SQLSTATE codes we translate to client-facing statuses */
const PG_UNIQUE_VIOLATION = "23505";
const PG_CHECK_VIOLATION = "23514";
const PG_FK_VIOLATION = "23503";

/** Extract a Postgres SQLSTATE code from an unknown error, if present */
const pgCode = (err: unknown): string | undefined =>
  typeof err === "object" && err !== null && "code" in err
    ? String((err as { code: unknown }).code)
    : undefined;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  // 1. Validation errors (Zod) → 400 with field details
  if (err instanceof ZodError) {
    const body: ErrorBody = {
      ok: false,
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: err.flatten(),
    };
    res.status(400).json(body);
    return;
  }

  // 2. Known domain errors carry their own status + code
  if (err instanceof AppError) {
    res.status(err.status).json({ ok: false, error: err.message, code: err.code } as ErrorBody);
    return;
  }

  // 3. Postgres constraint violations (defense-in-depth backstop)
  const code = pgCode(err);
  if (code === PG_UNIQUE_VIOLATION) {
    res
      .status(409)
      .json({ ok: false, error: "Resource already exists", code: "CONFLICT" } as ErrorBody);
    return;
  }
  if (code === PG_CHECK_VIOLATION) {
    res
      .status(400)
      .json({ ok: false, error: "Value out of allowed range", code: "CHECK_VIOLATION" } as ErrorBody);
    return;
  }
  if (code === PG_FK_VIOLATION) {
    res
      .status(404)
      .json({ ok: false, error: "Referenced resource not found", code: "NOT_FOUND" } as ErrorBody);
    return;
  }

  // 4. Unknown — log and return 500 without leaking internals
  console.error("[api] unhandled error:", err);
  res
    .status(500)
    .json({ ok: false, error: "Internal server error", code: "INTERNAL_ERROR" } as ErrorBody);
}
