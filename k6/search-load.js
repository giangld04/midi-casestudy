// k6 load test — concurrent song search (Performance deliverable).
//
// GET /api/songs/search is authenticated, so each VU signs up once and seeds a
// song, then issues randomized search queries. Search falls back to Postgres
// ILIKE when GEMINI_API_KEY is absent, so this measures the read path regardless
// of AI configuration.
//
// Run:  k6 run k6/search-load.js
import http from "k6/http";
import { check, fail } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export const options = {
  vus: 20,
  duration: "30s",
  thresholds: {
    http_req_duration: ["p(95)<300"],
    http_req_failed: ["rate<0.01"],
  },
};

const JSON_HEADERS = { "Content-Type": "application/json" };
const TERMS = ["piano", "jazz", "ambient", "techno", "lofi", "melody", "bass", "drum"];

let initialized = false;

function signUpAndSeed() {
  const email = `k6s-${__VU}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const auth = http.post(
    `${BASE_URL}/api/auth/sign-up/email`,
    JSON.stringify({ email, password: "Test1234!", name: `k6 search VU${__VU}` }),
    { headers: JSON_HEADERS },
  );
  if (auth.status !== 200 && auth.status !== 201) {
    fail(`sign-up failed (${auth.status}): ${auth.body}`);
  }
  // Seed one song so there is something to match.
  const term = TERMS[__VU % TERMS.length];
  http.post(
    `${BASE_URL}/api/songs`,
    JSON.stringify({ title: `${term} study VU${__VU}`, description: `a ${term} piece` }),
    { headers: JSON_HEADERS },
  );
}

export default function () {
  if (!initialized) {
    signUpAndSeed();
    initialized = true;
  }

  const q = TERMS[Math.floor(Math.random() * TERMS.length)];
  const res = http.get(`${BASE_URL}/api/songs/search?q=${encodeURIComponent(q)}&limit=10`);

  check(res, {
    "search ok (200)": (r) => r.status === 200,
    "returns data array": (r) => Array.isArray(r.json("data")),
  });
}
