/**
 * Typed fetch wrapper for the AMA-MIDI REST API.
 *
 * All endpoints return `{ ok: true, data: T }` on success or
 * `{ ok: false, error: string, code: string }` with a non-2xx status on error.
 * DELETE returns 204 with no body.
 *
 * Usage:
 *   const songs = await apiFetch<Song[]>("/api/songs");
 */

import type { ApiResponse } from "@ama-midi/shared";

/** Error thrown when the server returns ok:false or a non-ok HTTP status */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Perform a fetch and unwrap the `{ok,data}` envelope.
 * Throws `ApiError` for API-level errors or HTTP errors.
 * Returns `undefined` for 204 No Content responses.
 */
export async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    // include cookies so the session cookie is sent with every request
    credentials: "include",
    ...options,
  });

  // 204 No Content — nothing to parse
  if (res.status === 204) {
    return undefined as unknown as T;
  }

  const body = (await res.json()) as ApiResponse<T>;

  if (!res.ok || !body.ok) {
    const envelope = body as unknown as { error?: string; code?: string };
    throw new ApiError(
      envelope.error ?? `HTTP ${res.status}`,
      res.status,
      envelope.code ?? "UNKNOWN"
    );
  }

  return body.data;
}
