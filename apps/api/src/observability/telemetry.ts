/**
 * OpenTelemetry bootstrap — instrument the API ONCE, then push traces + metrics +
 * logs over a single OTLP endpoint to any backend (Grafana Cloud by default).
 *
 * MUST load before express/pg/ioredis are required so auto-instrumentation can
 * patch them — hence dev imports this first in index.ts and prod preloads it via
 * `node --require ./dist/observability/telemetry.js`. Idempotent (globalThis flag)
 * so the two paths never double-start the SDK.
 *
 * NO-OP unless OTEL_EXPORTER_OTLP_ENDPOINT is set → local dev + tests run untouched.
 * All exporter config (endpoint, headers/auth, protocol, service name, resource
 * attributes) comes from standard OTEL_* env vars, so no secrets live in code.
 */

import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";

// Shared across the preload copy and the bundled-in copy so we start exactly once.
const guard = globalThis as typeof globalThis & { __amaOtelStarted?: boolean };
const endpoint = process.env["OTEL_EXPORTER_OTLP_ENDPOINT"];

let sdk: NodeSDK | undefined;

if (endpoint && !guard.__amaOtelStarted) {
  guard.__amaOtelStarted = true;

  sdk = new NodeSDK({
    // Exporters read OTEL_EXPORTER_OTLP_ENDPOINT / _HEADERS / _PROTOCOL automatically.
    traceExporter: new OTLPTraceExporter(),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter(),
      exportIntervalMillis: 30_000,
    }),
    logRecordProcessors: [
      new BatchLogRecordProcessor({ exporter: new OTLPLogExporter() }),
    ],
    instrumentations: [
      getNodeAutoInstrumentations({
        // fs spans are extremely noisy and rarely actionable for a web API.
        "@opentelemetry/instrumentation-fs": { enabled: false },
        // pino: inject trace_id/span_id into logs + bridge them to the Logs SDK.
        "@opentelemetry/instrumentation-pino": { enabled: true },
      }),
    ],
  });

  sdk.start();
  // eslint-disable-next-line no-console -- logger isn't up yet at bootstrap
  console.log(`[otel] telemetry started → ${endpoint}`);

  // Flush buffered spans/metrics/logs on Railway redeploys (SIGTERM) or Ctrl-C.
  const shutdown = (signal: string) => {
    void sdk
      ?.shutdown()
      .then(() => console.log(`[otel] shut down (${signal})`))
      .catch((err) => console.error("[otel] shutdown error", err))
      .finally(() => process.exit(0));
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

export { sdk };
