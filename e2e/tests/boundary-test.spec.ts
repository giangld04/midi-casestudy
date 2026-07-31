// Deliverable: boundary test — the grid is bounded to track 1-8 and
// timeTick 0-1200 (= 0..300s). Out-of-range writes are rejected end-to-end
// (Zod validator + DB CHECK), while the boundary values themselves are accepted.
//
// Note: the canvas UI *clamps* pointer coords, so an out-of-range value can
// never be produced by a click. We therefore assert rejection through the real
// authenticated HTTP path (page.request carries the session cookie), and assert
// acceptance both via API (exact boundary) and via a real canvas click.
import { test, expect } from "@playwright/test";
import { signUp, createSong, getSongIdByTitle, clickCell, expectNoteCount } from "./helpers";

test.describe("Grid boundary enforcement", () => {
  test("rejects out-of-range notes and accepts boundary values", async ({ page }) => {
    await signUp(page);
    const title = `Boundary ${Date.now()}`;
    await createSong(page, title);
    const songId = await getSongIdByTitle(page, title);

    const post = (body: Record<string, unknown>) =>
      page.request.post(`/api/songs/${songId}/notes`, { data: body });

    // --- Rejections (400) ---
    expect((await post({ title: "over", track: 8, timeTick: 1201 })).status()).toBe(400);
    expect((await post({ title: "under", track: 8, timeTick: -1 })).status()).toBe(400);
    expect((await post({ title: "track0", track: 0, timeTick: 0 })).status()).toBe(400);
    expect((await post({ title: "track9", track: 9, timeTick: 0 })).status()).toBe(400);

    // --- Accepted boundary values (201) ---
    expect((await post({ title: "max", track: 8, timeTick: 1200 })).status()).toBe(201);
    expect((await post({ title: "min", track: 1, timeTick: 0 })).status()).toBe(201);

    // Rejections created nothing; only the two boundary notes exist so far.
    await expectNoteCount(page, songId, 2);

    // --- A real in-bounds canvas click also creates a note ---
    await clickCell(page, 3, 40);
    await expectNoteCount(page, songId, 3);
  });
});
