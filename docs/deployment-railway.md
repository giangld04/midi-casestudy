# Deployment — Railway

Step-by-step runbook to deploy AMA-MIDI (api + web + Postgres/pgvector + Redis) on
[Railway](https://railway.com). Config: **email/password auth only** (OAuth + Gemini skipped —
search falls back to ILIKE, auth falls back to email/password).

Everything on Railway is a container. This deploy uses **4 services** in one project:

| Service    | Source                     | Public? | Notes                                  |
| ---------- | -------------------------- | ------- | -------------------------------------- |
| `postgres` | pgvector template (pg16)   | no      | provides `DATABASE_URL`                |
| `redis`    | Redis template             | no      | provides `REDIS_URL`                   |
| `api`      | repo · `apps/api/Dockerfile` | yes   | Express + Socket.io on port 3000       |
| `web`      | repo · `apps/web/Dockerfile` | yes   | nginx SPA on port 80                   |

> The web SPA talks **directly** to the API's public domain (socket.io + Better Auth).
> `VITE_API_URL` is baked in at **build time**, so it must be set before the web build runs.

---

## 0. Prerequisites

```bash
railway login          # opens browser — must be done by you
railway whoami         # confirm logged in
```

Generate an auth secret (save it, you'll paste it into the api service):

```bash
openssl rand -base64 32
```

---

## 1. Create project + databases (Dashboard)

1. **New Project** → name it `ama-midi`.
2. **+ New → Database → Deploy pgvector** (pg16 template):
   <https://railway.com/deploy/pgvector> — gives a Postgres with the `vector` extension available.
   Migration `0000` runs `CREATE EXTENSION IF NOT EXISTS vector;` automatically, so no manual SQL.
3. **+ New → Database → Redis**.

## 2. Add the two app services (same GitHub repo)

Repo: `github.com/giangld04/midi-casestudy`.

For **api**:
- **+ New → GitHub Repo** → select the repo.
- Settings → **Build**: Dockerfile Path = `apps/api/Dockerfile` (build context stays repo root).
- Settings → **Networking** → **Generate Domain** (target port **3000**). Note the URL → `API_URL`.

For **web**:
- **+ New → GitHub Repo** → same repo again (second service).
- Settings → **Build**: Dockerfile Path = `apps/web/Dockerfile`.
- Settings → **Networking** → **Generate Domain** (target port **80**). Note the URL → `WEB_URL`.

## 3. Set environment variables

**api** service → Variables (use Railway reference syntax for DB/Redis):

```
NODE_ENV=production
PORT=3000
AUTH_SECRET=<paste the openssl secret>
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
AUTH_URL=https://<API_URL>
CORS_ORIGIN=https://<WEB_URL>
WEB_ORIGIN=https://<WEB_URL>
```

> Reference names (`Postgres`, `Redis`) must match your service names — adjust if different.

**web** service → Variables (build-time, baked into the SPA):

```
VITE_API_URL=https://<API_URL>
```

## 4. Deploy + migrate

1. Trigger a deploy on both `api` and `web` (Railway auto-deploys on variable change / git push).
2. Watch **api** logs → wait for the server to bind `:3000`.
3. **Run migrations** from your machine against the DB's public URL (one-time):

   ```bash
   # Copy DATABASE_PUBLIC_URL from the Postgres service → Variables tab
   cd apps/../packages/db   # i.e. packages/db
   DATABASE_URL="<DATABASE_PUBLIC_URL>" npx tsx src/migrate.ts
   ```

   Expect: `Running migrations... Migrations complete.`

4. Open `https://<WEB_URL>` → sign up with email/password → place notes.

---

## CLI alternative (after `railway login`)

```bash
railway init                      # create project (interactive)
railway add --database postgres   # then swap image to pgvector/pgvector:pg16 in dashboard, OR use template
railway add --database redis
# link + deploy each service dir; set vars with `railway variables --set K=V`
railway up                        # deploys the linked service using its Dockerfile settings
```

The Dashboard flow above is more reliable for the two-Dockerfile monorepo + pgvector, so prefer it.

---

## Troubleshooting

- **Frontend calls `localhost:3000`** → `VITE_API_URL` was missing at build time. Set it on the
  **web** service and redeploy (it's an `ARG`/`ENV` in `apps/web/Dockerfile`).
- **CORS / cookie errors on login** → `CORS_ORIGIN`/`WEB_ORIGIN` must exactly equal `https://<WEB_URL>`
  (no trailing slash); `AUTH_URL` must equal `https://<API_URL>`.
- **Migration `type "vector" does not exist`** → Postgres isn't the pgvector template. Re-add via the
  pgvector template and re-run migrations.
- **Web 502 / no response** → web service target port must be **80** (nginx), api target port **3000**.
- **Redis adapter errors** → confirm `REDIS_URL=${{Redis.REDIS_URL}}` resolved (check api Variables).
