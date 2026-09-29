// Domain model and validation for all persisted state.
// Everything the user can edit goes through normState() so cloud sync and
// localStorage round-trips cannot poison the app with malformed data.

export const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
export const TIME = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

export const uid4 = (): string =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now() + "-" + Math.random().toString(16).slice(2);

/** Strip control chars, trim, cap length — for any free-text string we persist. */
export const norm = (s: unknown): string =>
  String(s ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, 300);

export type Plate = "lec" | "lab";

export const C: Record<string, string> = {
  AP: "Advanced Programming (CSA213 · 4cr)",
  ADA: "Analysis and Design of Algorithms (CSA311 · 4cr)",
  DE: "Data Engineering (CSA214 · 4cr)",
  M3: "Mathematics III (CSA113 · 4cr)",
  DES: "Design minor",
  LHL: "Learning How to Learn (1cr)",
};

/** Seed attendance totals [attended, total] per course + plate. */
export const SEED: Record<string, { lec: [number, number]; lab?: [number, number] }> = {
  AP: { lec: [12, 14], lab: [11, 15] },
  ADA: { lec: [11, 15], lab: [12, 14] },
  DE: { lec: [12, 14], lab: [10, 13] },
  M3: { lec: [10, 13], lab: [10, 14] },
  DES: { lec: [22, 27] },
  LHL: { lec: [1, 4] },
};

export interface Slot {
  t: string; // start time "HH:MM"
  e: string; // end time "HH:MM" or ""
  c: string; // course key
  p: Plate;
}

const S = (t: string, e: string, c: string, p: Plate): Slot => ({ t, e, c, p });

export const DAY0: Record<number, Slot[]> = {
  1: [S("09:00", "10:30", "AP", "lec"), S("10:30", "12:00", "ADA", "lec"), S("13:00", "14:20", "M3", "lec"), S("14:30", "15:50", "DE", "lab"), S("16:00", "17:00", "DES", "lec")],
  2: [S("09:00", "10:30", "AP", "lec"), S("10:30", "12:00", "ADA", "lab"), S("13:00", "14:20", "M3", "lab"), S("14:30", "15:50", "DE", "lec"), S("16:00", "17:00", "DES", "lec")],
  3: [S("09:00", "10:30", "AP", "lab"), S("10:30", "12:00", "ADA", "lec"), S("13:00", "14:20", "M3", "lec"), S("14:30", "15:50", "DE", "lab"), S("16:00", "17:00", "DES", "lec")],
  4: [S("09:00", "10:30", "AP", "lec"), S("10:30", "12:00", "ADA", "lab"), S("13:00", "14:20", "M3", "lab"), S("14:30", "15:50", "DE", "lec"), S("16:00", "17:00", "DES", "lec")],
};

export const ROUT: [string, string][] = [["20:30", "Family call"], ["22:00", "Gym"]];

export const DEF_TASKS: Task[] = [
  { id: "1", t: "AP Lab problems", due: "2026-09-29T17:35", n: 0, of: 9 },
  { id: "2", t: "DE problems", due: "2026-09-29T17:35", n: 0, of: 10 },
];

export const DEF_EVENTS: Ev[] = [
  { id: "1", t: "M3 Contest 1", d: "2026-09-04", tm: "16:00" },
  { id: "2", t: "ADA Contest 1", d: "2026-09-11", tm: "16:00" },
  { id: "3", t: "DE Contest 1", d: "2026-09-18", tm: "16:00" },
  { id: "4", t: "AP Contest 1", d: "2026-09-25", tm: "16:00" },
  { id: "5", t: "Gandhi Jayanti (holiday)", d: "2026-10-02", tm: "" },
  { id: "6", t: "Maths III Contest 2", d: "2026-10-09", tm: "16:00" },
  { id: "7", t: "Midsem exams", d: "2026-10-12", tm: "" },
  { id: "8", t: "Midsem exams end", d: "2026-10-16", tm: "" },
  { id: "9", t: "Dussehra (holiday)", d: "2026-10-20", tm: "" },
  { id: "10", t: "Elective contest", d: "2026-10-23", tm: "16:00" },
  { id: "11", t: "ADA Contest 2", d: "2026-10-30", tm: "16:00" },
  { id: "12", t: "Diwali break starts", d: "2026-11-06", tm: "" },
  { id: "13", t: "Diwali break ends", d: "2026-11-13", tm: "" },
  { id: "14", t: "DE Contest 2", d: "2026-11-20", tm: "16:00" },
  { id: "15", t: "AP Contest 2", d: "2026-11-27", tm: "16:00" },
  { id: "16", t: "Damru fest", d: "2026-11-28", tm: "" },
  { id: "17", t: "Classes end", d: "2026-12-08", tm: "" },
  { id: "18", t: "Endsem exams start", d: "2026-12-09", tm: "" },
  { id: "19", t: "Endsem exams end", d: "2026-12-24", tm: "" },
  { id: "20", t: "Winter break starts", d: "2026-12-25", tm: "" },
];

export interface Task {
  id: string;
  t: string;
  due: string; // "YYYY-MM-DDTHH:MM"
  n: number;
  of: number;
}

export interface Ev {
  id: string;
  t: string;
  d: string; // "YYYY-MM-DD"
  tm: string; // "HH:MM" or ""
}

export interface CodeEntry {
  id: string;
  d: string; // "YYYY-MM-DD"
  t: string;
  x: string;
  n?: number; // GitHub commit count
  k?: string; // Codeforces practice/contest
}

export interface CodeState {
  lc: CodeEntry[];
  cf: CodeEntry[];
  gh: CodeEntry[];
  rating: string;
}

export interface AppState {
  dw?: boolean;
  sfrom?: string;
  rout: Record<string, boolean>;
  tasks: Task[];
  ev: Ev[];
  code: CodeState;
  log: Record<string, "P" | "A">;
  extra: Record<string, Slot[]>;
  old?: Record<number, Slot[]>;
  sched?: Record<number, Slot[]>;
}

export function defaultState(): AppState {
  return {
    dw: undefined,
    sfrom: undefined,
    rout: {},
    tasks: JSON.parse(JSON.stringify(DEF_TASKS)),
    ev: JSON.parse(JSON.stringify(DEF_EVENTS)),
    code: { lc: [], cf: [], gh: [], rating: "" },
    log: {},
    extra: {},
  };
}

/** Deep-clean any untrusted object into a valid AppState. */
export function normState(s: unknown): AppState {
  const d = defaultState();
  if (!s || typeof s !== "object") return d;
  const src = s as Record<string, unknown>;

  if (typeof src.dw === "boolean") d.dw = src.dw;
  if (typeof src.sfrom === "string" && DATE.test(src.sfrom)) d.sfrom = src.sfrom;

  if (src.rout && typeof src.rout === "object")
    for (const [k, v] of Object.entries(src.rout))
      if (typeof v === "boolean") d.rout[k] = v;

  if (Array.isArray(src.tasks))
    d.tasks = src.tasks
      .filter((t): t is Record<string, any> => !!t && typeof t === "object" && typeof (t as any).t === "string" && (t as any).t.trim())
      .map((t) => ({
        id: String(t.id ?? uid4()),
        t: norm(t.t),
        due: typeof t.due === "string" && DT.test(t.due) ? t.due : new Date().toISOString().slice(0, 16),
        n: Math.max(0, Math.min(+t.of || 1, +t.n || 0)),
        of: Math.max(1, Math.min(999, Math.floor(+t.of) || 1)),
      }))
      .filter((t) => t.t);

  if (Array.isArray(src.ev))
    d.ev = src.ev
      .filter((e): e is Record<string, any> => !!e && typeof e === "object" && typeof (e as any).t === "string" && (e as any).t.trim() && typeof (e as any).d === "string" && DATE.test((e as any).d))
      .map((e) => ({
        id: String(e.id ?? uid4()),
        t: norm(e.t),
        d: e.d as string,
        tm: TIME.test(e.tm) ? (e.tm as string) : "",
      }))
      .filter((e) => e.t);

  if (src.code && typeof src.code === "object") {
    const code = src.code as Record<string, unknown>;
    for (const k of ["lc", "cf", "gh"] as const) {
      if (!Array.isArray(code[k])) continue;
      d.code[k] = (code[k] as unknown[])
        .filter((e): e is Record<string, any> => !!e && typeof e === "object" && typeof (e as any).t === "string" && (e as any).t.trim() && typeof (e as any).d === "string" && DATE.test((e as any).d))
        .map((e) => {
          const o: CodeEntry = {
            id: String(e.id ?? uid4()),
            d: e.d as string,
            t: norm(e.t),
            x: norm(typeof e.x === "number" ? String(e.x) : e.x),
          };
          if (k === "gh" && Number.isFinite(+(e.n as number))) o.n = Math.max(1, Math.floor(+(e.n as number)));
          return o;
        })
        .filter((e) => e.t);
    }
    if (typeof code.rating === "string") d.code.rating = code.rating.slice(0, 4);
  }

  if (src.log && typeof src.log === "object")
    for (const [k, v] of Object.entries(src.log))
      if (/^\d{4}-\d{2}-\d{2}\|\w{1,8}$/.test(k) && (v === "P" || v === "A")) d.log[k] = v;

  if (src.extra && typeof src.extra === "object")
    for (const [ds, L] of Object.entries(src.extra)) {
      if (!DATE.test(ds) || !Array.isArray(L)) continue;
      const a = (L as unknown[])
        .filter((x): x is Record<string, any> => !!x && typeof x === "object" && typeof (x as any).t === "string" && typeof (x as any).e === "string" && !!(x as any).c && !!C[(x as any).c] && ["lec", "lab"].includes((x as any).p))
        .map((x) => ({ t: norm(x.t) || "extra", e: norm(x.e), c: String(x.c), p: String(x.p) === "lab" ? "lab" as const : "lec" as const }));
      if (a.length) d.extra[ds] = a;
    }

  for (const key of ["old", "sched"] as const) {
    const s2 = src[key];
    if (!s2 || typeof s2 !== "object") continue;
    const out: Record<number, Slot[]> = {};
    for (const dk of Object.keys(s2)) {
      const day = +dk;
      if (!(day >= 1 && day <= 6) || !Array.isArray((s2 as Record<string, unknown>)[dk])) continue;
      const a = ((s2 as Record<string, unknown>)[dk] as unknown[])
        .filter((x): x is Record<string, any> => !!x && typeof x === "object" && typeof (x as any).t === "string" && TIME.test((x as any).t) && !!(x as any).c && !!C[(x as any).c] && ["lec", "lab"].includes((x as any).p))
        .map((x) => ({ t: norm(x.t), e: TIME.test(x.e) ? norm(x.e) : "", c: String(x.c), p: String(x.p) === "lab" ? "lab" as const : "lec" as const }));
      if (a.length) out[day] = a;
    }
    if (Object.keys(out).length) d[key] = out;
  }

  return d;
}

// ---------- date helpers ----------

export const iso = (d: Date): string =>
  d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

export const td = (): string => iso(new Date());

export const back = (i: number): string => iso(new Date(Date.now() - 864e5 * i));

// ---------- derived stats ----------

export function slotsOf(state: AppState, ds: string): (Slot & { id: string; x?: number })[] {
  const d = new Date(ds + "T00:00");
  const sch = state.old && state.sfrom && ds < state.sfrom ? state.old : state.sched || DAY0;
  const base = (sch[d.getDay()] || []).map((s, i) => ({ ...s, id: ds + "|" + i }));
  const ex = (state.extra[ds] || []).map((s, i) => ({ ...s, id: ds + "|x" + i, x: 1 }));
  return base.concat(ex);
}

export function counts(state: AppState, c: string, p: Plate, skip?: Plate): [number, number] {
  const seed = SEED[c]?.[p];
  let a = seed ? seed[0] : 0;
  let t = seed ? seed[1] : 0;
  for (const [k, v] of Object.entries(state.log)) {
    const [ds] = k.split("|");
    const sl = slotsOf(state, ds).find((z) => z.id === k);
    if (sl && sl.c === c && sl.p === p) {
      if (v === "P") { a++; t++; }
      else if (v === "A") t++;
    }
  }
  if (skip) t++;
  return [a, t];
}

export function avg(state: AppState, c: string, skipP?: Plate): number {
  const ps = Object.keys(SEED[c]);
  const v = ps.map((p) => {
    const [a, t] = counts(state, c, p as Plate, skipP === p ? (p as Plate) : undefined);
    return (a / t) * 100;
  });
  return v.reduce((x, y) => x + y, 0) / v.length;
}

/** Attendance threshold: 75 default, 60 with "approved leeway". */
export const TH = (state: AppState): number => (state.dw === false ? 75 : 60);

export const POL: [string, string][] = [
  ["std", "Standard — target 75%"],
  ["no", "Approved leeway — 60% cutoff"],
  ["low", "Medical / Venture Studio — 50% floor"],
];

export function st(state: AppState, c: string, x: number): [string, string] {
  if (c === "LHL") return ["Optional", ""];
  const T = TH(state);
  return x >= T ? ["Safe", "ok"]
    : x >= T - 15 && T === 75 ? ["Below 75", "warn"]
    : x >= 50 ? [T === 60 ? "Below 60" : "Danger", T === 60 ? "warn" : "bad"]
    : ["Critical", "bad"];
}

export const f1 = (x: number): string => x.toFixed(1);
