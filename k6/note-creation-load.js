// k6 load test — concurrent note creation (Performance deliverable).
//
// Each virtual user signs up once (Better Auth email/password), creates its own
// song, then hammers POST /api/songs/:id/notes with unique grid cells. Because
// every VU owns a distinct song, writes never collide — so a non-2xx response
// signals a real performance/availability failure, not an expected 409 conflict.
//
// Run:  k6 run k6/note-creation-load.js
//       k6 run -e BASE_URL=https://your-api k6/note-creation-load.js
import http from "k6/http";
import { check, fail } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export const options = {
  vus: 50,
  duration: "30s",
  thresholds: {
    // 95th percentile under 500ms; fewer than 1% failed requests.
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

const JSON_HEADERS = { "Content-Type": "application/json" };

// Per-VU state (each k6 VU runs its own isolate, so these are VU-scoped).
let initialized = false;
let songId = null;

function signUp() {
  const email = `k6-${__VU}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const res = http.post(
    `${BASE_URL}/api/auth/sign-up/email`,
    JSON.stringify({ email, password: "Test1234!", name: `k6 VU${__VU}` }),
    { headers: JSON_HEADERS },
  );
  if (res.status !== 200 && res.status !== 201) {
    fail(`sign-up failed (${res.status}): ${res.body}`);
  }
  // The session cookie is stored in this VU's cookie jar automatically.
}

function createSong() {
  const res = http.post(
    `${BASE_URL}/api/songs`,
    JSON.stringify({ title: `k6 song VU${__VU}` }),
    { headers: JSON_HEADERS },
  );
  check(res, { "song created (201)": (r) => r.status === 201 });
  return res.json("data.id");
}

export default function () {
  if (!initialized) {
    signUp();
    songId = createSong();
    initialized = true;
  }

  // Unique cell per iteration: track fixed per VU, tick walks 0..1200.
  const track = (__VU % 8) + 1;
  const timeTick = __ITER % 1201;

  const res = http.post(
    `${BASE_URL}/api/songs/${songId}/notes`,
    JSON.stringify({ title: `n${__ITER}`, track, timeTick }),
    { headers: JSON_HEADERS },
  );

  check(res, {
    "note created (201)": (r) => r.status === 201,
  });
}
