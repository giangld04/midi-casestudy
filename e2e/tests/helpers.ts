// Shared e2e helpers: real signup (Better Auth email/password), song creation,
// and Konva-canvas grid interaction. No mocks — every action drives the real
// UI → API → Postgres/Redis stack.
import { expect, type Page } from "@playwright/test";

// Grid model (mirrors apps/web coordinate-utils): 8 track columns, default 4px/tick.
export const TRACK_COUNT = 8;
export const DEFAULT_PIXELS_PER_TICK = 4;

export function uniqueEmail(prefix = "e2e"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

/**
 * Register a brand-new user and land on the authenticated app shell.
 *
 * We create the session programmatically via the request context (which is not
 * subject to browser CORS/preflight), storing the session cookie in the browser
 * context. Navigating then lets Better Auth's useSession hydrate from that
 * cookie — exercising ProtectedRoute end-to-end without depending on the
 * cross-origin auth POST from the browser.
 */
export async function signUp(page: Page): Promise<{ email: string }> {
  const email = uniqueEmail();
  const res = await page.request.post("/api/auth/sign-up/email", {
    data: { email, password: "Test1234!", name: "E2E User" },
  });
  if (!res.ok()) {
    throw new Error(`sign-up failed (${res.status()}): ${await res.text()}`);
  }

  await page.goto("/");
  // Authenticated shell: the Songs sidebar header appears.
  await expect(page.getByText("Songs", { exact: true })).toBeVisible();
  return { email };
}

/** Create a song via the sidebar dialog; it is auto-selected and the canvas mounts. */
export async function createSong(page: Page, title: string): Promise<void> {
  await page.getByTitle("New song").click();
  await page.getByPlaceholder("Song title…").fill(title);
  await page.getByRole("button", { name: "Create" }).click();
  await waitForCanvas(page);
}

/** Select an existing song from the sidebar by its title (for a 2nd collaborator). */
export async function selectSong(page: Page, title: string): Promise<void> {
  await page.getByRole("button", { name: title }).click();
  await waitForCanvas(page);
}

/** The Konva scene canvas fills the piano-roll stage once a song is open. */
export async function waitForCanvas(page: Page): Promise<void> {
  await expect(page.locator("canvas").first()).toBeVisible();
}

/**
 * Click a specific grid cell on the piano-roll canvas.
 * track: 1..8, tick: 0..1200. Uses the same forward map the app uses, so the
 * server receives exactly (track, tick).
 */
export async function clickCell(
  page: Page,
  track: number,
  tick: number,
  pixelsPerTick = DEFAULT_PIXELS_PER_TICK,
): Promise<void> {
  // Konva stacks one <canvas> per layer (grid/notes/selection/cursors). They all
  // share identical geometry and Konva hit-tests internally, so we drive the
  // topmost layer and force past the sibling-overlap hit-test check.
  const canvas = page.locator("canvas").last();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("piano-roll canvas has no bounding box");
  const trackWidth = box.width / TRACK_COUNT;
  const x = (track - 0.5) * trackWidth; // center of the track column
  const y = tick * pixelsPerTick;
  await canvas.click({ position: { x, y }, force: true });
}

/** Fetch a song id by title through the authenticated API (cookies from context). */
export async function getSongIdByTitle(page: Page, title: string): Promise<string> {
  const res = await page.request.get("/api/songs");
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { data: Array<{ id: string; title: string }> };
  const song = body.data.find((s) => s.title === title);
  if (!song) throw new Error(`song "${title}" not found via API`);
  return song.id;
}

/** Fetch notes of a song through the authenticated API. */
export async function getNotes(
  page: Page,
  songId: string,
): Promise<Array<{ id: string; track: number; timeTick: number }>> {
  const res = await page.request.get(`/api/songs/${songId}/notes`);
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as {
    data: Array<{ id: string; track: number; timeTick: number }>;
  };
  return body.data;
}

/** Poll the API until the song has exactly `expected` notes (or times out). */
export async function expectNoteCount(
  page: Page,
  songId: string,
  expected: number,
): Promise<void> {
  await expect
    .poll(async () => (await getNotes(page, songId)).length, { timeout: 10_000 })
    .toBe(expected);
}
