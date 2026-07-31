// Deliverable: real-time sync — a note created by one collaborator appears in
// another collaborator's open editor without a reload, via the Socket.io
// broadcast (note:created). Notes render on the canvas, so we assert the live
// note-count text that the toolbar/status bar derive from client state.
import { test, expect } from "@playwright/test";
import { signUp, createSong, selectSong, clickCell } from "./helpers";

test("a note created by user A appears live in user B's editor", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  try {
    await signUp(pageA);
    const title = `Sync ${Date.now()}`;
    await createSong(pageA, title);

    await signUp(pageB);
    await selectSong(pageB, title);

    // B starts with an empty song (status bar reflects live client state).
    await expect(pageB.getByText("0 notes — click grid to add")).toBeVisible();

    // A adds a note; B must receive it over the socket (no reload).
    await clickCell(pageA, 2, 60);

    await expect(pageB.getByText("1 note — click grid to add")).toBeVisible();
    await expect(pageA.getByText("1 note — click grid to add")).toBeVisible();
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});
