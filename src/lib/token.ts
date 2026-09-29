// App token (for the AI endpoint in local-only mode) is asked once and kept
// for the browser session only, mirroring the original behavior.
const KEY = "apptok";

export function getToken(): string {
  try {
    let t = sessionStorage.getItem(KEY);
    if (!t) {
      t = localStorage.getItem(KEY) || "";
      if (t) {
        sessionStorage.setItem(KEY, t);
        localStorage.removeItem(KEY);
      }
    }
    return t;
  } catch {
    return "";
  }
}

export function setToken(v: string): void {
  try {
    if (v) sessionStorage.setItem(KEY, v);
    else sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
