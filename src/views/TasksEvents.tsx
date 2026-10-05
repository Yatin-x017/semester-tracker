import { useState } from "react";
import { DATE, DT, TIME, norm, uid4, type AppState, type Ev, type Task } from "../lib/model";
import TaskRow from "../components/TaskRow";

function EventRow({
  e,
  onDelete,
  onEdit,
}: {
  e: Ev;
  onDelete: (id: string) => void;
  onEdit: (id: string, patch: Partial<Ev>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(e.t);
  const [date, setDate] = useState(e.d);
  const [time, setTime] = useState(e.tm);

  if (editing) {
    const save = (ev: React.FormEvent) => {
      ev.preventDefault();
      onEdit(e.id, { t: norm(title) || e.t, d: DATE.test(date) ? date : e.d, tm: TIME.test(time) ? time : "" });
      setEditing(false);
    };
    return (
      <form className="row edit" onSubmit={save}>
        <input type="text" value={title} onChange={(ev) => setTitle(ev.target.value)} aria-label="Event title" autoFocus />
        <input type="date" value={date} onChange={(ev) => setDate(ev.target.value)} aria-label="Date" />
        <input
          type="text"
          value={time}
          onChange={(ev) => setTime(ev.target.value)}
          placeholder="HH:MM"
          style={{ width: "6rem" }}
          aria-label="Time"
        />
        <button className="b on">Save</button>
        <button className="b" type="button" onClick={() => setEditing(false)}>
          Cancel
        </button>
      </form>
    );
  }

  const startEdit = () => {
    setTitle(e.t);
    setDate(e.d);
    setTime(e.tm);
    setEditing(true);
  };

  return (
    <div className="row">
      <span className="m">{e.d}</span>
      <span className="g">{e.t}</span>
      <span className="m">{e.tm}</span>
      <button className="b" onClick={startEdit} aria-label="Edit event">
        Edit
      </button>
      <button className="b" onClick={() => onDelete(e.id)} aria-label="Delete event">
        Delete
      </button>
    </div>
  );
}

export default function TasksEvents({ state, setState }: { state: AppState; setState: (u: (s: AppState) => AppState) => void }) {
  const addTask = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const t = String(f.get("t") || "").trim();
    const due = String(f.get("due") || "");
    const of = Math.max(1, Math.min(999, parseInt(String(f.get("of") || "1"), 10) || 1));
    if (!t || !DT.test(due)) return;
    setState((s) => ({ ...s, tasks: [...s.tasks, { id: uid4(), t: norm(t), due, n: 0, of }] }));
    e.currentTarget.reset();
  };

  const addEvent = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const t = String(f.get("t") || "").trim();
    const d = String(f.get("d") || "");
    const rawTm = String(f.get("tm") || "").trim();
    if (!t || !DATE.test(d)) return;
    setState((s) => ({ ...s, ev: [...s.ev, { id: uid4(), t: norm(t), d, tm: TIME.test(rawTm) ? rawTm : "" }] }));
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

  const delEvent = (id: string) => setState((s) => ({ ...s, ev: s.ev.filter((e) => e.id !== id) }));

  const editEvent = (id: string, patch: Partial<Ev>) =>
    setState((s) => ({ ...s, ev: s.ev.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));

  return (
    <>
      <h1>Tasks and events</h1>
      <h2>Tasks</h2>
      {state.tasks.map((t) => (
        <TaskRow key={t.id} t={t} onBump={bumpTask} onDelete={delTask} onEdit={editTask} />
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
          <EventRow key={e.id} e={e} onDelete={delEvent} onEdit={editEvent} />
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
