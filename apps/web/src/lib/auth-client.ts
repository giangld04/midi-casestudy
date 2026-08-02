// Better Auth React client — talks to the Express API's /api/auth routes.
//
// Same-origin by default: with VITE_API_URL empty the client uses THIS origin,
// where nginx (prod) / the Vite dev proxy forwards /api to the API host. Keeping
// requests first-party is what makes the session cookie stick — a cross-site
// (third-party) cookie is silently dropped by modern browsers, which was why
// login "worked" server-side but the SPA bounced back to the login page.
import { createAuthClient } from "better-auth/react";

// "" → same origin. Set VITE_API_URL only to point at a remote API (e.g. dev).
const API_URL = (import.meta.env["VITE_API_URL"] as string | undefined) ?? "";

export const authClient = createAuthClient({
  baseURL: API_URL || window.location.origin,
  basePath: "/api/auth",
});
