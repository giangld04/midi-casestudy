// Better Auth React client — configured to point at the Express API's /api/auth routes.
import { createAuthClient } from "better-auth/react";

const API_URL = (import.meta.env["VITE_API_URL"] as string | undefined) ?? "http://localhost:3000";

export const authClient = createAuthClient({
  baseURL: API_URL,
  basePath: "/api/auth",
});
