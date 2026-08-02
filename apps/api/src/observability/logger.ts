/**
 * Structured JSON logger (pino). The OpenTelemetry pino instrumentation (wired in
 * telemetry.ts) automatically injects `trace_id` + `span_id` into every log record
 * emitted inside an active span, giving log↔trace correlation for free — click a log
 * line in Grafana/Loki and jump to its Tempo trace.
 *
 * Logs go to stdout (captured by Railway) and, when telemetry is active, are also
 * bridged to the OTLP Logs exporter → Loki.
 */

import pino from "pino";

export const logger = pino({
  level: process.env["LOG_LEVEL"] ?? "info",
  // Emit `level` as a string ("info") instead of the numeric code — friendlier in Loki.
  formatters: { level: (label) => ({ level: label }) },
  // ISO timestamps for readable time-series correlation.
  timestamp: pino.stdTimeFunctions.isoTime,
});
