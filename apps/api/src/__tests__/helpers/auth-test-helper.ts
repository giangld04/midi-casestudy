// Auth test helpers — sign up a real user via Better Auth and return the
// session cookie string for use with supertest and socket.io-client.
// Uses unique emails per call so parallel tests don't collide on unique constraint.
import request from "supertest";
import { app } from "../../index";
import { db } from "../../db";
import { authAccount, authSession, authUser, authVerification } from "@ama-midi/db";

/** Creates a user + session via Better Auth and returns the Set-Cookie header value. */
export async function signUpAndGetCookie(
  email?: string,
  password = "Test1234!",
): Promise<string> {
  const uniqueEmail = email ?? `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

  // Register a new user
  const signUpRes = await request(app)
    .post("/api/auth/sign-up/email")
    .send({ email: uniqueEmail, password, name: "Test User" });

  if (signUpRes.status !== 200 && signUpRes.status !== 201) {
    throw new Error(
      `Sign-up failed (${signUpRes.status}): ${JSON.stringify(signUpRes.body)}`,
    );
  }

  // Extract session cookie from Set-Cookie header
  const cookies = signUpRes.headers["set-cookie"] as string[] | string | undefined;
  if (!cookies) {
    throw new Error("No Set-Cookie header in sign-up response");
  }

  // Set-Cookie may be an array; join for use with supertest .set("Cookie", ...)
  const cookieStr = Array.isArray(cookies) ? cookies.join("; ") : cookies;
  return cookieStr;
}

/** Extract just the cookie header string suitable for socket.io extraHeaders. */
export function cookieHeader(cookies: string): string {
  // Extract "name=value" parts (drop Set-Cookie directives like Path, HttpOnly, etc.)
  return cookies
    .split(/,(?=[^;]+=[^;]+;)/)
    .map((part) => part.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

/** Clean up all Better Auth tables (call in afterAll or afterEach). */
export async function cleanAuthTables(): Promise<void> {
  await db.delete(authVerification);
  await db.delete(authSession);
  await db.delete(authAccount);
  await db.delete(authUser);
}
