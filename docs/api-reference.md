# API Reference

Base URL (dev): `http://localhost:3000`. The web app reaches it via the Vite `/api` proxy.

## Conventions

**Response envelope** (all REST routes):

```jsonc
// success
{ "ok": true, "data": <payload> }
// error
{ "ok": false, "error": "message", "code": "ERROR_CODE" }
```

**Auth:** `/api/songs/*` and `/api/notes/*` require a valid Better Auth **session cookie**
(sent automatically by the browser). Missing/invalid session → `401`.

**CSRF:** mutating methods (POST/PUT/DELETE) must carry an `Origin`/`Referer` from a trusted
origin (defaults `http://localhost:5173`, `http://localhost:3000`).

**Rate limit:** authenticated 100 req / 15 min (keyed by user id); unauthenticated 30 req /
15 min (keyed by IP).

**Common codes:** `400` validation, `401` unauthenticated, `403` forbidden origin,
`404` not found, `409` conflict (duplicate cell / stale version).

---

## Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | none | Liveness. `{ ok, data: { ts } }` |

## Songs

| Method | Path | Auth | Body | Success |
|--------|------|------|------|---------|
| GET | `/api/songs` | ✓ | — | `200` list |
| GET | `/api/songs/:id` | ✓ | — | `200` song |
| POST | `/api/songs` | ✓ | `{ title, description? }` | `201` song |
| PUT | `/api/songs/:id` | ✓ | `{ title?, description? }` (≥1 field) | `200` song |
| DELETE | `/api/songs/:id` | ✓ | — | `204` (cascades notes + events) |

Body rules: `title` 1–255 chars; `description` ≤ 2000 chars. `updateSongSchema` requires at
least one field. Creating/updating title or description triggers a fire-and-forget re-embed.

## Notes

Notes are nested under a song for list/create; keyed directly by id for update/delete.

| Method | Path | Auth | Body | Success |
|--------|------|------|------|---------|
| GET | `/api/songs/:songId/notes` | ✓ | — | `200` list (ordered track, tick) |
| POST | `/api/songs/:songId/notes` | ✓ | create body ↓ | `201` note |
| PUT | `/api/notes/:id` | ✓ | update body ↓ | `200` note (version+1) |
| DELETE | `/api/notes/:id` | ✓ | — | `204` |

**Create body**

```jsonc
{
  "title": "C4",            // 1–255
  "description": "…",       // optional, ≤1000
  "track": 3,               // int 1–8
  "timeTick": 120,          // int 0–1200  (1 tick = 0.25s → 1200 = 300s)
  "color": "#22d3ee"        // optional, /^#[0-9a-fA-F]{6}$/
}
```

**Update body** — all editable fields optional, but `version` is **required** (optimistic lock):

```jsonc
{ "title?": "…", "track?": 3, "timeTick?": 120, "color?": "#…", "version": 1 }
```

**Conflict semantics (`409`)**

- Create at an occupied `(song_id, track, time_tick)` → `CONFLICT` ("note already exists…").
- Update with a stale `version` → `CONFLICT` ("Stale version…"). Missing note → `404`.

## Search

| Method | Path | Auth | Query | Success |
|--------|------|------|-------|---------|
| GET | `/api/songs/search` | ✓ | `q` (1–500), `limit` (1–50, default 10) | `200` results |

Semantic search: embeds `q` via Gemini and ranks by pgvector cosine distance, returning a
`similarity` score `[0..1]`. If the Gemini key is absent or the API is down, it **falls back to
ILIKE** text match (`similarity: null`) — never a `500`. Invalid `q` → `400` `VALIDATION_ERROR`.

## Auth (Better Auth — `/api/auth/*`)

Handled by Better Auth (mounted before `express.json`). Common endpoints:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/sign-up/email` | `{ email, password, name }` → sets session cookie |
| POST | `/api/auth/sign-in/email` | `{ email, password }` → sets session cookie |
| POST | `/api/auth/sign-out` | Clears session (immediate DB revocation) |
| GET | `/api/auth/get-session` | Current session/user or null |
| GET | `/api/auth/callback/:provider` | OAuth callback (Google/GitHub when configured) |

Session cookie: HttpOnly, SameSite=Lax, Secure in prod, 7-day expiry, daily refresh, cookie
cache disabled (validated against DB each request).

---

## Socket.io Events

WebSocket shares the API port. The handshake requires the same session cookie; unauthenticated
connections are rejected with `UNAUTHORIZED`. All note mutations reuse the REST service layer,
so integrity guarantees are identical.

**Client → Server**

| Event | Payload | Notes |
|-------|---------|-------|
| `join-song` | `{ songId, name }` | Joins room `song:{id}`; one active room per socket |
| `leave-song` | `{ songId }` | Leaves room |
| `cursor:move` | `{ songId, track, timeTick }` | Volatile relay (must have joined) |
| `note:create` | `{ songId, reqId, title, track, timeTick, color? }` | Gated by room + rate limit (60/min) |
| `note:update` | `{ songId, noteId, reqId, …, version }` | Optimistic-locked |
| `note:delete` | `{ songId, noteId, reqId }` | |

**Server → Client**

| Event | Payload | Notes |
|-------|---------|-------|
| `presence:update` | `{ users: PresenceUser[] }` | Broadcast on join/leave |
| `cursor:update` | `{ userId, name, color, track, timeTick }` | Volatile |
| `cursor:leave` | `{ userId }` | On leave/disconnect |
| `note:created` / `note:updated` | `{ note, reqId }` | Broadcast to whole room |
| `note:deleted` | `{ noteId, reqId }` | Broadcast to whole room |
| `note:rejected` | `{ reqId, code, error }` | Sender only |

**Reject codes:** `CONFLICT`, `NOT_FOUND`, `VALIDATION`, `FORBIDDEN`, `RATE_LIMIT`,
`SERVER_ERROR`. The sender reconciles optimistic state by `reqId`.
