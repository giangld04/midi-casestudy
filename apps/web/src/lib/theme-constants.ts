/**
 * Design-token literals for contexts where CSS custom properties cannot be used
 * (e.g. Konva canvas props). Values must stay in sync with globals.css :root.
 */

/** Primary accent (cyan) — matches --accent-green / --accent in globals.css */
export const ACCENT_GREEN = "#00d4ff";

/** Semi-transparent accent fill for marquee selection — matches --accent-green-soft */
export const ACCENT_GREEN_SOFT = "rgba(0, 212, 255, 0.15)";
