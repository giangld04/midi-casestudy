// Minimal in-memory sliding-window rate limiter keyed by socket id.
// Guards note mutation events (Phase 05 security: max 60 events/min per user).
// No external deps — a bounded array of recent timestamps per key.

interface Window {
  timestamps: number[];
}

export class RateLimiter {
  private readonly windows = new Map<string, Window>();

  constructor(
    private readonly limit: number,
    private readonly intervalMs: number,
  ) {}

  /** Returns true if the action is allowed and records it; false if over limit. */
  take(key: string): boolean {
    const now = Date.now();
    const cutoff = now - this.intervalMs;
    const win = this.windows.get(key) ?? { timestamps: [] };
    // Drop timestamps outside the current window
    win.timestamps = win.timestamps.filter((t) => t > cutoff);
    if (win.timestamps.length >= this.limit) {
      this.windows.set(key, win);
      return false;
    }
    win.timestamps.push(now);
    this.windows.set(key, win);
    return true;
  }

  /** Forget a key (call on disconnect to avoid unbounded growth). */
  clear(key: string): void {
    this.windows.delete(key);
  }
}
