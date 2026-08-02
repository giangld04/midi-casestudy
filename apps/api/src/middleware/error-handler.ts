// Global error handler — the single exit point where every thrown/rejected error
// becomes a consistent JSON envelope { ok:false, error, code, traceId? }.
//
// Production error-tracing flow (this is the important part):
//   • classify() maps Zod / AppError / Postgres constraints → HTTP status + code.
//   • The active OpenTelemetry span is marked ERROR + records the exception on 5xx
//     so the request shows up as an error trace in Tempo (4xx are expected client
//     errors → span left OK, so they don't pollute the error rate).
//   • The trace_id is attached to the structured log (pino auto-injects it too) AND
//     returned to the client, so one failing request is traceable end-to-end:
//       response.traceId → Tempo (the trace) → Loki (its logs, same trace_id).
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { AppError } from "../lib/errors";
import { logger } from "../observability/logger";

/** Shape returned for any error response */
interface ErrorBody {
  ok: false;
  error: string;
  code: string;
  details?: unknown;
  /** Present when a trace is active → quote this to find the request in Tempo. */
  traceId?: string;
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

/** Resolve an unknown error to its client-facing HTTP status + JSON body. */
function classify(err: unknown): { status: number; body: ErrorBody } {
  // 1. Validation errors (Zod) → 400 with field details
  if (err instanceof ZodError) {
    return {
      status: 400,
      body: { ok: false, error: "Validation failed", code: "VALIDATION_ERROR", details: err.flatten() },
    };
  }

  // 2. Known domain errors carry their own status + code
  if (err instanceof AppError) {
    return { status: err.status, body: { ok: false, error: err.message, code: err.code } };
  }

  // 3. Postgres constraint violations (defense-in-depth backstop)
  switch (pgCode(err)) {
    case PG_UNIQUE_VIOLATION:
      return { status: 409, body: { ok: false, error: "Resource already exists", code: "CONFLICT" } };
    case PG_CHECK_VIOLATION:
      return { status: 400, body: { ok: false, error: "Value out of allowed range", code: "CHECK_VIOLATION" } };
    case PG_FK_VIOLATION:
      return { status: 404, body: { ok: false, error: "Referenced resource not found", code: "NOT_FOUND" } };
  }

  // 4. Unknown → 500 without leaking internals
  return { status: 500, body: { ok: false, error: "Internal server error", code: "INTERNAL_ERROR" } };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const { status, body } = classify(err);

  // Correlate this failure with its distributed trace.
  const span = trace.getActiveSpan();
  const traceId = span?.spanContext().traceId;
  if (traceId) body.traceId = traceId;

  // 5xx = server fault → record the exception + flag the span so it surfaces as an
  // error trace in Tempo. 4xx = expected client error → leave the span status OK.
  if (span && status >= 500) {
    span.recordException(err as Error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: body.code });
  }

  // Structured log — pino instrumentation injects trace_id/span_id automatically.
  const entry = { err, code: body.code, status, method: req.method, path: req.originalUrl };
  if (status >= 500) logger.error(entry, "[api] request failed");
  else logger.warn(entry, "[api] request rejected");

  res.status(status).json(body);
}
