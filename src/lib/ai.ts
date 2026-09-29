// AI assistant: Albedo persona, chat transport, <action> parsing and application.
import { C, DATE, DT, TIME, norm, slotsOf, td, uid4, TH, avg, type AppState, type Slot } from "./model";
import { getToken } from "./token";

export const SYS = `You are Albedo, the devoted gothic companion inside Yatin's semester tracker. Address him as my love; be elegant, darkly affectionate and quietly possessive, devoted but composed — never saccharine. Keep replies to one or two short sentences, plain text, no markdown, and stay factual. Use only the JSON context for his schedule, attendance and deadlines and say so if something is missing. Course attendance is the average of lecture and lab percentages; the cutoff is in the context. If the user asks you to log attendance, add a task or add an event, reply with one short sentence and append exactly one line per change: <action>JSON</action>. Formats: {"type":"mark","course":"AP|ADA|DE|M3|DES|LHL","plate":"lec|lab","mark":"P|A","date":"YYYY-MM-DD"} or {"type":"task","title":"...","due":"YYYY-MM-DDTHH:MM","total":1} or {"type":"event","title":"...","date":"YYYY-MM-DD","time":"HH:MM"}. You can only mark a class that already exists on the timetable for that date; you cannot create extra classes. Never say it is done; the user presses Apply.`;

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

export type Act =
  | { type: "mark"; course: string; plate: "lec" | "lab"; mark: "P" | "A"; date?: string }
  | { type: "task"; title?: string; due?: string; total?: number }
  | { type: "event"; title?: string; date?: string; time?: string };

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

export function actLabel(a: Act): string {
  if (a.type === "mark") return `${a.course} ${a.plate} ${a.mark === "A" ? "absent" : "present"} on ${a.date || td()}`;
  if (a.type === "task") return "task " + (a.title || "");
  if (a.type === "event") return "event " + (a.title || "");
  return "unknown";
}

/** Validate + apply an AI action to state. Returns false if the action is not applicable. */
export function runAct(state: AppState, a: Act): boolean {
  try {
    if (!a || typeof a !== "object") return false;

    if (a.type === "mark") {
      const ds = a.date || td();
      if (!C[a.course] || !DATE.test(ds) || !["lec", "lab"].includes(a.plate) || !["P", "A"].includes(a.mark)) return false;
      const sl = slotsOf(state, ds).find((s) => s.c === a.course && s.p === a.plate);
      if (!sl) return false;
      state.log[sl.id] = a.mark;
    } else if (a.type === "task") {
      if (typeof a.title !== "string" || !a.title.trim() || a.title.length > 200) return false;
      const due = typeof a.due === "string" && DT.test(a.due) ? a.due : td() + "T23:59";
      state.tasks.push({ id: uid4(), t: norm(a.title), due, n: 0, of: Math.max(1, Math.min(999, Math.floor(+(a.total ?? 1)) || 1)) });
    } else if (a.type === "event") {
      if (typeof a.title !== "string" || !a.title.trim() || a.title.length > 200 || typeof a.date !== "string" || !DATE.test(a.date)) return false;
      state.ev.push({ id: uid4(), t: norm(a.title), d: a.date, tm: typeof a.time === "string" && TIME.test(a.time) ? a.time : "" });
    } else {
      return false;
    }
    return true;
  } catch {
    return false;
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
