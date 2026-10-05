import { C, ROUT, TH, avg, f1, iso, slotsOf, type AppState, type Task } from "../lib/model";
import TaskRow from "../components/TaskRow";

interface Props {
  state: AppState;
  setState: (u: (s: AppState) => AppState) => void;
  cur: Date;
  setCur: (d: Date) => void;
}

export default function Today({ state, setState, cur, setCur }: Props) {
  const ds = iso(cur);
  const slots = slotsOf(state, ds);
  const open = state.tasks.filter((t) => t.n < t.of);
  const due = open.filter((t) => new Date(t.due).getTime() - Date.now() < 864e5 * 2);

  const mark = (id: string, v: "P" | "A") =>
    setState((s) => {
      const log = { ...s.log };
      if (log[id] === v) delete log[id];
      else log[id] = v;
      return { ...s, log };
    });

  const addExtra = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const c = String(f.get("c") || "");
    const p = String(f.get("p") || "lec");
    const t = String(f.get("t") || "").trim();
    if (!c || !C[c]) return;
    setState((s) => {
      const extra = { ...s.extra };
      extra[ds] = [...(extra[ds] || []), { t: t || "extra", e: "", c, p: p as "lec" | "lab" }];
      return { ...s, extra };
    });
    e.currentTarget.reset();
  };

  const bumpTask = (id: string, d: number) =>
    setState((s) => ({
      ...s,
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, n: Math.max(0, Math.min(t.of, t.n + d)) } : t)),
    }));

  const delTask = (id: string) => setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));

  const editTask = (id: string, patch: Partial<Task>) =>
    setState((s) => ({
      ...s,
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch, n: Math.min(t.n, patch.of ?? t.of) } : t)),
    }));

  const toggleRout = (key: string, on: boolean) =>
    setState((s) => ({ ...s, rout: { ...s.rout, [key]: on } }));

  const evs = state.ev.filter((e) => e.d === ds);

  return (
    <>
      <h1>{cur.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h1>
      <div className="nav">
        <button className="b" onClick={() => setCur(new Date(cur.getTime() - 864e5))}>Previous day</button>
        <button className="b" onClick={() => setCur(new Date())}>Today</button>
        <button className="b" onClick={() => setCur(new Date(cur.getTime() + 864e5))}>Next day</button>
      </div>

      {due.length > 0 && (
        <div className="call">
          <strong>Due soon:</strong>{" "}
          {due
            .map(
              (t) =>
                `${t.t} (${t.n}/${t.of}) by ${new Date(t.due).toLocaleString("en-GB", {
                  weekday: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}`
            )
            .join("; ")}
        </div>
      )}

      <h2>Classes</h2>
      {slots.length === 0 ? (
        <p className="sub">No scheduled classes.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Class</th>
              <th>Attendance</th>
              <th>If you skip</th>
            </tr>
          </thead>
          <tbody>
            {slots.map((s) => {
              const v = state.log[s.id];
              const now = avg(state, s.c);
              const sk = avg(state, s.c, s.p);
              return (
                <tr key={s.id}>
                  <td className="m">{s.t}{s.e ? "–" + s.e : ""}</td>
                  <td>
                    {C[s.c]} <span className="hint">{s.p === "lab" ? "lab" : "lecture"}</span>
                  </td>
                  <td>
                    <span className="seg">
                      <button className={"b P" + (v === "P" ? " on" : "")} onClick={() => mark(s.id, "P")}>Present</button>
                      <button className={"b A" + (v === "A" ? " on" : "")} onClick={() => mark(s.id, "A")}>Absent</button>
                    </span>
                  </td>
                  <td className="m" style={s.c !== "LHL" && sk < TH(state) ? { color: "var(--bad)" } : undefined}>
                    {s.c === "LHL" ? "optional" : f1(now) + " to " + f1(sk)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <form onSubmit={addExtra} className="extra-form">
        <select name="c" defaultValue="AP" aria-label="Course">
          {Object.keys(C).map((c) => (
            <option key={c} value={c}>{C[c]}</option>
          ))}
        </select>
        <select name="p" aria-label="Type">
          <option value="lec">Lecture</option>
          <option value="lab">Lab</option>
        </select>
        <input type="text" name="t" placeholder="Time, e.g. 11:00" style={{ width: "9rem" }} />
        <button className="b">Log extra class</button>
      </form>

      <h2>Routine</h2>
      {ROUT.map(([time, name]) => {
        const key = ds + "|" + name;
        return (
          <div className={"row" + (state.rout[key] ? " done" : "")} key={key}>
            <input type="checkbox" checked={!!state.rout[key]} onChange={(e) => toggleRout(key, e.target.checked)} aria-label={name} />
            <span className="m">{time}</span>
            <span className="g">{name}</span>
          </div>
        );
      })}

      <h2>Events today</h2>
      {evs.length ? (
        evs.map((e) => (
          <div className="row" key={e.id}>
            <span className="m">{e.tm || "all day"}</span>
            <span className="g">{e.t}</span>
          </div>
        ))
      ) : (
        <p className="sub">Nothing scheduled.</p>
      )}

      <h2>Tasks open</h2>
      {open.length ? (
        open.map((t) => <TaskRow key={t.id} t={t} onBump={bumpTask} onDelete={delTask} onEdit={editTask} />)
      ) : (
        <p className="sub">All clear.</p>
      )}
    </>
  );
}
