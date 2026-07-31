// Deliverable: auth flow. An unauthenticated visitor is gated by ProtectedRoute
// and must sign in; after signup the editor shell loads.
import { test, expect } from "@playwright/test";
import { signUp } from "./helpers";

test.describe("Auth flow", () => {
  test("unauthenticated visitor sees the login page (protected route)", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Sign in to continue")).toBeVisible();
    // Editor chrome must NOT be reachable without a session.
    await expect(page.getByText("Songs", { exact: true })).toHaveCount(0);
  });

  test("signup logs in and reveals the editor shell", async ({ page }) => {
    await signUp(page);
    await expect(page.getByText("Songs", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Select or create a song to start editing"),
    ).toBeVisible();
  });
});
