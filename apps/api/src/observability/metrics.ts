/**
 * Domain metrics that auto-instrumentation can't infer. RED metrics for HTTP
 * (rate/errors/duration) come free from the http/express instrumentation; here we
 * add app-level signals — starting with the count of live Socket.io connections,
 * a good saturation/traffic proxy for the realtime collaboration layer.
 *
 * Uses the global MeterProvider set up by telemetry.ts. When telemetry is a no-op
 * (no OTLP endpoint), these resolve to a harmless no-op meter.
 */

import { metrics } from "@opentelemetry/api";

const meter = metrics.getMeter("ama-midi-api");

/** Active WebSocket connections (UpDownCounter → rendered as a gauge). */
export const activeSocketConnections = meter.createUpDownCounter(
  "app_socket_connections_active",
  { description: "Currently connected Socket.io clients" },
);
