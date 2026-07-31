// Deliverable: conflict test — two users target the SAME grid cell at the same
// time. The UNIQUE(song_id, track, time_tick) constraint guarantees exactly one
// winner; the other write is rejected. We assert the authoritative outcome:
// the song ends up with exactly one note at that cell (no silent overwrite).
import { test, expect } from "@playwright/test";
import { signUp, createSong, selectSong, getSongIdByTitle, clickCell, getNotes } from "./helpers";

test("two users writing the same cell → exactly one note survives", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  try {
    // User A creates the shared song.
    await signUp(pageA);
    const title = `Conflict ${Date.now()}`;
    await createSong(pageA, title);
    const songId = await getSongIdByTitle(pageA, title);

    // User B (separate session) joins the same song from the shared song list.
    await signUp(pageB);
    await selectSong(pageB, title);

    // Both click the identical cell as close to simultaneously as possible.
    const TRACK = 5;
    const TICK = 80;
    await Promise.all([clickCell(pageA, TRACK, TICK), clickCell(pageB, TRACK, TICK)]);

    // Authoritative check: the cell holds exactly one note.
    await expect
      .poll(async () => (await getNotes(pageA, songId)).length, { timeout: 10_000 })
      .toBe(1);

    const notes = await getNotes(pageA, songId);
    expect(notes[0]).toMatchObject({ track: TRACK, timeTick: TICK });
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});
