import { norm, uid4, type AppState } from "../lib/model";
import TaskRow from "../components/TaskRow";

export default function TasksEvents({ state, setState }: { state: AppState; setState: (u: (s: AppState) => AppState) => void }) {
  const addTask = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const t = String(f.get("t") || "").trim();
    const due = String(f.get("due") || "");
    const of = Math.max(1, Math.min(999, parseInt(String(f.get("of") || "1"), 10) || 1));
    if (!t || !due) return;
    setState((s) => ({ ...s, tasks: [...s.tasks, { id: uid4(), t: norm(t), due, n: 0, of }] }));
    e.currentTarget.reset();
  };

  const addEvent = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const t = String(f.get("t") || "").trim();
    const d = String(f.get("d") || "");
    const tm = String(f.get("tm") || "").trim();
    if (!t || !d) return;
    setState((s) => ({ ...s, ev: [...s.ev, { id: uid4(), t: norm(t), d, tm }] }));
    e.currentTarget.reset();
  };

  const bumpTask = (id: string, d: number) =>
    setState((s) => ({
      ...s,
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, n: Math.max(0, Math.min(t.of, t.n + d)) } : t)),
    }));

  const delTask = (id: string) => setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));
  const delEvent = (id: string) => setState((s) => ({ ...s, ev: s.ev.filter((e) => e.id !== id) }));

  return (
    <>
      <h1>Tasks and events</h1>
      <h2>Tasks</h2>
      {state.tasks.map((t) => (
        <TaskRow key={t.id} t={t} onBump={bumpTask} onDelete={delTask} />
      ))}
      <form onSubmit={addTask}>
        <input type="text" name="t" placeholder="New task" required />
        <input type="datetime-local" name="due" required />
        <input type="number" name="of" min={1} defaultValue={1} style={{ width: "5rem" }} aria-label="Total items" />
        <button className="b">Add task</button>
      </form>

      <h2>Events</h2>
      {[...state.ev]
        .sort((a, b) => a.d.localeCompare(b.d))
        .map((e) => (
          <div className="row" key={e.id}>
            <span className="m">{e.d}</span>
            <span className="g">{e.t}</span>
            <span className="m">{e.tm}</span>
            <button className="b" onClick={() => delEvent(e.id)}>Delete</button>
          </div>
        ))}
      <form onSubmit={addEvent}>
        <input type="text" name="t" placeholder="New event" required />
        <input type="date" name="d" required />
        <input type="text" name="tm" placeholder="Time" style={{ width: "6rem" }} />
        <button className="b">Add event</button>
      </form>
    </>
  );
}
