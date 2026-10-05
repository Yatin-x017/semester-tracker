import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StoreProvider, useStore } from "./lib/store";
import { defaultState, iso, normState, slotsOf, td, type AppState } from "./lib/model";
import Today from "./views/Today";
import Attendance from "./views/Attendance";
import TasksEvents from "./views/TasksEvents";
import Coding from "./views/Coding";
import Import from "./views/Import";
import Assistant from "./components/Assistant";
// three.js + VRM are heavy; load the waifu chunk only when opened
const Waifu = lazy(() => import("./components/Waifu"));
import { onWaifuSay } from "./lib/bus";
import { speak } from "./lib/speech";
import type { ImpRow } from "./lib/ai";

function greeting(state: AppState): string {
  const h = new Date().getHours();
  const ds = td();
  const cls = slotsOf(state, ds).length;
  const due = state.tasks.filter((t) => t.n < t.of && new Date(t.due).getTime() - Date.now() < 864e5 * 2).length;
  const evs = state.ev.filter((e) => e.d === ds).length;
  const hi =
    h < 5 ? "The night is yours, my love."
    : h < 12 ? "Good morning, my love."
    : h < 17 ? "The afternoon fades, my love."
    : h < 22 ? "Good evening, my love."
    : "Another late night? You work yourself to the bone.";
  const b = [hi];
  if (cls) b.push(cls + (cls === 1 ? " class awaits" : " classes await") + " you today.");
  if (due) b.push(due + (due === 1 ? " task" : " tasks") + " cry out to be finished within two days.");
  if (evs) b.push(evs + (evs === 1 ? " event" : " events") + " graces today.");
  return b.join(" ");
}

function Shell() {
  const { state, setState, view, setView, syncing, signedIn, authOpen, openAuth, sb, authHeaders, signIn, signOut, skipSignIn } = useStore();
  const [cur, setCur] = useState(new Date());
  const [waifuOpen, setWaifuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [impRows, setImpRows] = useState<ImpRow[] | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() => (document.documentElement.dataset.theme as "dark" | "light") || "dark");

  // wire assistant text to waifu speech (speak() reads the persisted voice/mute live)
  useEffect(() => onWaifuSay((t) => {
    if (!t) return;
    speak(t);
  }), []);

  const toggleTheme = useCallback(() => {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("vftheme", next);
    } catch {
      /* ignore */
    }
    setTheme(next);
  }, []);

  const applyImport = useCallback(() => {
    if (!impRows) return;
    const n: Record<number, import("./lib/model").Slot[]> = {};
    for (const r of impRows) {
      if (!r.start) continue;
      (n[+r.day] = n[+r.day] || []).push({ t: r.start, e: r.end, c: r.course, p: r.plate });
    }
    for (const k in n) n[k].sort((a, b) => a.t.localeCompare(b.t));
    setState((s) => ({ ...s, old: s.sched, sfrom: td(), sched: n }));
    setImpRows(null);
    setView("today");
  }, [impRows, setState, setView]);

  const reset = () => {
    if (confirm("Erase all logged data?")) {
      setState(() => defaultState());
    }
  };

  const viewEl = useMemo(() => {
    if (impRows) return <Import rows={impRows} setRows={setImpRows} onApply={applyImport} onCancel={() => setImpRows(null)} />;
    if (view === "today") return <Today state={state} setState={setState} cur={cur} setCur={setCur} />;
    if (view === "att") return <Attendance state={state} setState={setState} />;
    if (view === "tasks") return <TasksEvents state={state} setState={setState} />;
    if (view === "code") return <Coding state={state} setState={setState} />;
    return null;
  }, [impRows, view, state, setState, cur, applyImport]);

  return (
    <div className="app">
      <aside aria-label="Pages">
        <div className="t">Semester 3</div>
        {[
          ["today", "Today"],
          ["att", "Attendance"],
          ["tasks", "Tasks and events"],
          ["code", "Coding"],
        ].map(([v, label]) => (
          <button key={v} data-v={v} aria-current={view === v ? "page" : undefined} onClick={() => setView(v)}>
            {label}
          </button>
        ))}
        <button id="tg" className="mob" onClick={() => setAiOpen((v) => !v)}>AI assistant</button>
        <section id="ai" className={aiOpen ? "open" : ""} aria-label="AI assistant">
          <Assistant
            state={state}
            setState={setState}
            viewing={iso(cur)}
            authHeaders={authHeaders}
            onRows={(r) => {
              setImpRows(r);
              setAiOpen(false);
            }}
            onUnauthorized={() => setSettingsOpen(true)}
            onClose={() => setAiOpen(false)}
          />
        </section>
        <div id="sy" className="hint" style={{ padding: "0 10px" }}>{syncing}</div>
        {sb && <button onClick={() => (signedIn ? void signOut() : openAuth())}>{signedIn ? "Sign out" : "Sign in"}</button>}
        <button onClick={toggleTheme}>{theme === "dark" ? "Light mode" : "Dark mode"}</button>
        <button onClick={() => setWaifuOpen(true)} hidden={waifuOpen}>Waifu</button>
        <button onClick={() => setSettingsOpen(true)}>Settings</button>
        <button onClick={reset}>Reset all data</button>
      </aside>
      <main id="m">{viewEl}</main>
      {waifuOpen && (
        <Suspense fallback={null}>
          <Waifu greeting={greeting(state)} onClose={() => setWaifuOpen(false)} />
        </Suspense>
      )}
      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}
      {authOpen && <Auth signIn={signIn} skip={skipSignIn} />}
    </div>
  );
}

function Settings({ onClose }: { onClose: () => void }) {
  const { token, updateToken, sb, state, setState } = useStore();
  const [tok, setTok] = useState(token);
  const [v, setV] = useState(localStorage.getItem("vfvoice") || "aria");
  const [mute, setMute] = useState(() => localStorage.getItem("vfmute") === "1");
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    updateToken(tok.trim());
    localStorage.setItem("vfvoice", v);
    localStorage.setItem("vfmute", mute ? "1" : "0");
    onClose();
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "semester-tracker-" + td() + ".json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = async (f: File) => {
    try {
      const next = normState(JSON.parse(await f.text()));
      if (!confirm("Replace all current data with this backup?")) return;
      setState(() => next);
      setMsg("Backup imported.");
    } catch {
      setMsg("That file is not a valid backup.");
    }
  };

  return (
    <dialog open className="settings-dlg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form onSubmit={save}>
        <h2>Settings</h2>
        {!sb && (
          <>
            <label htmlFor="dtok">App token (AI actions)</label>
            <input
              id="dtok"
              type="password"
              value={tok}
              onChange={(e) => setTok(e.target.value)}
              placeholder="APP_TOKEN from .dev.vars"
              autoComplete="off"
            />
            <p className="sub">Asked only once when missing or wrong; kept for this browser session only.</p>
          </>
        )}
        <label htmlFor="dvoice">Waifu voice</label>
        <select id="dvoice" value={v} onChange={(e) => setV(e.target.value)}>
          <option value="aria">Aria — soft and low</option>
          <option value="gothic">Gothic — deep and slow</option>
          <option value="none">Silent</option>
        </select>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={mute} onChange={(e) => setMute(e.target.checked)} style={{ width: "auto" }} /> Mute waifu voice
        </label>
        <h3 className="settings-sub">Backup</h3>
        <p className="sub">Export a JSON copy of all your data, or restore one.</p>
        <div className="ar">
          <button className="b" type="button" onClick={exportData}>
            Export data
          </button>
          <button className="b" type="button" onClick={() => fileRef.current?.click()}>
            Import data
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void importData(f);
            }}
          />
        </div>
        {msg && <p className="hint">{msg}</p>}
        <div className="ar">
          <button className="b on">Save</button>
          <button className="b" type="button" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </dialog>
  );
}

function Auth({ signIn, skip }: { signIn: (email: string) => Promise<string>; skip: () => void }) {
  const [em, setEm] = useState("");
  const [msg, setMsg] = useState("");

  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("Sending...");
    setMsg(await signIn(em.trim()));
  };

  return (
    <div id="auth">
      <form onSubmit={go}>
        <h1 style={{ fontSize: "1.4rem" }}>Sign in</h1>
        <p className="sub">We will email you a sign-in link.</p>
        <input type="email" value={em} onChange={(e) => setEm(e.target.value)} placeholder="you@example.com" required autoComplete="email" />
        <button className="b on">Send sign-in link</button>
        <button className="b" type="button" onClick={skip}>Use without syncing</button>
        <p className="hint">{msg}</p>
    </form>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
