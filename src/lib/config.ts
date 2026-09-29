// Public runtime config loaded from /config.js (kept in public/config.js, copied at build).
// The anon key is designed to be exposed; row level security protects the data.
export interface Cfg {
  url: string;
  key: string;
}

declare global {
  interface Window {
    CFG?: Cfg;
  }
}

export const CFG: Cfg =
  typeof window !== "undefined" && window.CFG ? window.CFG : { url: "", key: "" };

export const HAS_SB = !!(CFG.url && CFG.key);
