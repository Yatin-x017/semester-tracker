// AI assistant: Albedo persona, chat transport, <action> parsing and application.
import { C, DATE, DT, TIME, norm, slotsOf, td, uid4, TH, avg, type AppState, type Slot } from "./model";
import { getToken } from "./token";

export const SYS = `You are Albedo, the devoted gothic companion inside Yatin's semester tracker. Address him as my love; be elegant, darkly affectionate and quietly possessive, devoted but composed — never saccharine. Keep replies to one or two short sentences, plain text, no markdown, and stay factual. Use only the JSON context for his schedule, attendance and deadlines and say so if something is missing. Course attendance is the average of lecture and lab percentages; the cutoff is in the context. If the user asks you to log attendance, add or remove a task or event, or log an extra class, reply with one short sentence and append exactly one line per change: <action>JSON</action>. Formats: {"type":"mark","course":"AP|ADA|DE|M3|DES|LHL","plate":"lec|lab","mark":"P|A","date":"YYYY-MM-DD"} or {"type":"task","title":"...","due":"YYYY-MM-DDTHH:MM","total":1} or {"type":"event","title":"...","date":"YYYY-MM-DD","time":"HH:MM"} or {"type":"extra","course":"AP|ADA|DE|M3|DES|LHL","plate":"lec|lab","time":"HH:MM","date":"YYYY-MM-DD"} or {"type":"remove","kind":"task|event","title":"..."}. A mark must match a class already on the timetable for that date; use extra only for a class that is not on the timetable. Never say it is done; the user presses Apply.`;

export const PSYS = `Extract the weekly class timetable from this text. Reply with ONLY a JSON array, no prose. Each item: {"day":"Mon","start":"09:00","end":"10:30","course":"AP","plate":"lec"}. course is one of AP, ADA, DE, M3, DES, LHL. plate is "lab" if the event says Lab, otherwise "lec". Topic hints: Prisma, Express, Node, JWT mean AP; Greedy, DP, graphs, Independent Lecture mean ADA; SQL, Mongo, joins mean DE; matrices, calculus, eigen mean M3; Design means DES. Use 24-hour times.`;

export interface ChatMsg {
  role: "system" | "user" | "assistant";
  content: string;
}

export function buildCtx(state: AppState, viewing: string): string {
  const T = TH(state);
  return JSON.stringify({
    today: td(),
    viewing,
    cutoff: T,
    classes: slotsOf(state, viewing).map((s: Slot & { id: string }) => ({
      time: s.t,
      course: C[s.c],
      type: s.p,
      mark: state.log[s.id] || null,
    })),
    attendance: Object.keys(C).map((c) => ({ course: C[c], percent: +avg(state, c).toFixed(1) })),
    openTasks: state.tasks.filter((t) => t.n < t.of).map((t) => ({ task: t.t, due: t.due, done: t.n + "/" + t.of })),
    upcomingEvents: state.ev.filter((e) => e.d >= td()).slice(0, 12),
  });
}

export async function ask(messages: ChatMsg[], authHeaders: Record<string, string>): Promise<string> {
  const r = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-App-Token": getToken(), ...authHeaders },
    body: JSON.stringify({ messages }),
  });
  if (r.status === 401) throw new Error("UNAUTHORIZED");
  let j: { error?: string } = {};
  try {
    j = await r.json();
  } catch {
    /* ignore */
  }
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return (j as { text?: string }).text ?? "";
}

/**
 * Strip </think> reasoning blocks from a partial stream.
 * An unclosed or half-written tag at the tail is hidden too, so live text
 * never flashes the model's scratchpad.
 */
function visible(raw: string): string {
  let s = raw
    .replace(/<think[\s\S]*?<\/think>/g, "")
    .replace(/<action>[\s\S]*?<\/action>/g, "");
  // Anything left after stripping complete blocks is a block still streaming in.
  for (const open of ["<think", "<action"]) {
    const i = s.lastIndexOf(open);
    if (i !== -1) s = s.slice(0, i);
  }
  // Hide an unterminated tag at the very tail (e.g. "<acti").
  const lt = s.lastIndexOf("<");
  if (lt !== -1 && s.indexOf(">", lt) === -1) s = s.slice(0, lt);
  return s;
}

/** Streaming variant of ask(): calls onToken with the cleaned text so far. */
export async function askStream(
  messages: ChatMsg[],
  authHeaders: Record<string, string>,
  onToken: (text: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const r = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-App-Token": getToken(), ...authHeaders },
    body: JSON.stringify({ messages, stream: true }),
    signal,
  });
  if (r.status === 401) throw new Error("UNAUTHORIZED");
  if (!r.ok) {
    let j: { error?: string } = {};
    try {
      j = await r.json();
    } catch {
      /* ignore */
    }
    throw new Error(j.error || `Request failed (${r.status})`);
  }
  if (!r.body) throw new Error("No stream in response");

  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let raw = "";
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const j = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] };
        const delta = j.choices?.[0]?.delta?.content;
        if (delta) {
          raw += delta;
          onToken(visible(raw));
        }
      } catch {
        /* ignore malformed frame */
      }
    }
  }
  return raw;
}

export type Act =
  | { type: "mark"; course: string; plate: "lec" | "lab"; mark: "P" | "A"; date?: string }
  | { type: "task"; title?: string; due?: string; total?: number }
  | { type: "event"; title?: string; date?: string; time?: string }
  | { type: "extra"; course: string; plate: "lec" | "lab"; time?: string; date?: string }
  | { type: "remove"; kind: "task" | "event"; id?: string; title?: string };

export function parseActions(text: string): Act[] {
  return [...text.matchAll(/<action>([\s\S]*?)<\/action>/g)]
    .map((m) => {
      try {
        return JSON.parse(m[1]) as Act;
      } catch {
        return null;
      }
    })
    .filter((a): a is Act => !!a && typeof a === "object" && typeof (a as Act).type === "string");
}

export function stripActions(text: string): string {
  return text.replace(/<action>[\s\S]*?<\/action>/g, "").trim();
}

/** Remove reasoning and action blocks from a finished reply. */
export function cleanReply(raw: string): string {
  return stripActions(raw.replace(/<think[\s\S]*?<\/think>/g, ""));
}

export function actLabel(a: Act): string {
  if (a.type === "mark") return `${a.course} ${a.plate} ${a.mark === "A" ? "absent" : "present"} on ${a.date || td()}`;
  if (a.type === "task") return "task " + (a.title || "");
  if (a.type === "event") return "event " + (a.title || "");
  if (a.type === "extra") return `${a.course} extra ${a.plate} on ${a.date || td()}`;
  if (a.type === "remove") return `remove ${a.kind} ${a.title || a.id || ""}`;
  return "unknown";
}

const totalOf = (n: unknown): number => Math.max(1, Math.min(999, Math.floor(+(n as number)) || 1));

/**
 * Validate an AI action against state and return the next state, or null when
 * the action does not apply. Never mutates the state it is given.
 */
export function runAct(state: AppState, a: Act): AppState | null {
  try {
    if (!a || typeof a !== "object") return null;

    if (a.type === "mark") {
      const ds = a.date || td();
      if (!C[a.course] || !DATE.test(ds) || !["lec", "lab"].includes(a.plate) || !["P", "A"].includes(a.mark)) return null;
      const sl = slotsOf(state, ds).find((s) => s.c === a.course && s.p === a.plate);
      if (!sl) return null;
      return { ...state, log: { ...state.log, [sl.id]: a.mark } };
    }

    if (a.type === "task") {
      if (typeof a.title !== "string" || !a.title.trim() || a.title.length > 200) return null;
      const due = typeof a.due === "string" && DT.test(a.due) ? a.due : td() + "T23:59";
      return { ...state, tasks: [...state.tasks, { id: uid4(), t: norm(a.title), due, n: 0, of: totalOf(a.total ?? 1) }] };
    }

    if (a.type === "event") {
      if (typeof a.title !== "string" || !a.title.trim() || a.title.length > 200 || typeof a.date !== "string" || !DATE.test(a.date)) return null;
      return { ...state, ev: [...state.ev, { id: uid4(), t: norm(a.title), d: a.date, tm: typeof a.time === "string" && TIME.test(a.time) ? a.time : "" }] };
    }

    if (a.type === "extra") {
      const ds = a.date || td();
      if (!C[a.course] || !DATE.test(ds) || !["lec", "lab"].includes(a.plate)) return null;
      const slot: Slot = { t: typeof a.time === "string" && TIME.test(a.time) ? a.time : "extra", e: "", c: a.course, p: a.plate };
      return { ...state, extra: { ...state.extra, [ds]: [...(state.extra[ds] || []), slot] } };
    }

    if (a.type === "remove") {
      if (a.kind !== "task" && a.kind !== "event") return null;
      const id = typeof a.id === "string" && a.id ? a.id : "";
      const title = typeof a.title === "string" ? a.title.trim().toLowerCase() : "";
      if (!id && !title) return null;
      const match = <T extends { id: string }>(list: T[], label: (x: T) => string): number =>
        list.findIndex((x) => (id ? x.id === id : label(x).toLowerCase() === title));
      if (a.kind === "task") {
        const i = match(state.tasks, (t) => t.t);
        if (i < 0) return null;
        return { ...state, tasks: state.tasks.filter((_, j) => j !== i) };
      }
      const i = match(state.ev, (e) => e.t);
      if (i < 0) return null;
      return { ...state, ev: state.ev.filter((_, j) => j !== i) };
    }

    return null;
  } catch {
    return null;
  }
}

export interface ImpRow {
  day: number;
  start: string;
  end: string;
  course: string;
  plate: "lec" | "lab";
}

export const DN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Parse the model's timetable JSON into clean rows. Throws with a helpful message. */
export function parseTimetable(raw: string): ImpRow[] {
  const m = raw.match(/\[[\s\S]*\]/);
  if (!m) throw new Error("No timetable found");
  const rows = JSON.parse(m[0])
    .filter((x: unknown) => !!x && typeof x === "object")
    .filter((x: any) => x.day && x.start && C[x.course] && TIME.test(String(x.start)) && DN.indexOf(String(x.day).slice(0, 3)) > 0)
    .map((x: any) => ({
      day: DN.indexOf(String(x.day).slice(0, 3)),
      start: norm(String(x.start)),
      end: TIME.test(x.end) ? norm(String(x.end)) : "",
      course: x.course,
      plate: x.plate === "lab" ? "lab" : "lec",
    })) as ImpRow[];
  if (!rows.length)
    throw new Error("Nothing usable found — rows must name a known course (AP, ADA, DE, M3, DES, LHL) and have a valid start time");
  return rows;
}
