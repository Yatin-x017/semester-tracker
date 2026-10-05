import { useState } from "react";
import { DT, norm, type Task } from "../lib/model";

const clampOf = (v: string): number => Math.max(1, Math.min(999, parseInt(v, 10) || 1));

export default function TaskRow({
  t,
  onBump,
  onDelete,
  onEdit,
}: {
  t: Task;
  onBump: (id: string, d: number) => void;
  onDelete: (id: string) => void;
  onEdit?: (id: string, patch: Partial<Task>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(t.t);
  const [due, setDue] = useState(t.due);
  const [of, setOf] = useState(String(t.of));
  const done = t.n >= t.of;

  const startEdit = () => {
    setTitle(t.t);
    setDue(t.due);
    setOf(String(t.of));
    setEditing(true);
  };

  if (editing) {
    const save = (e: React.FormEvent) => {
      e.preventDefault();
      onEdit?.(t.id, { t: norm(title) || t.t, due: DT.test(due) ? due : t.due, of: clampOf(of) });
      setEditing(false);
    };
    return (
      <form className="row edit" onSubmit={save}>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Task title" autoFocus />
        <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due" />
        <input
          type="number"
          min={1}
          value={of}
          onChange={(e) => setOf(e.target.value)}
          style={{ width: "4.5rem" }}
          aria-label="Total items"
        />
        <button className="b on">Save</button>
        <button className="b" type="button" onClick={() => setEditing(false)}>
          Cancel
        </button>
      </form>
    );
  }

  return (
    <div className={"row" + (done ? " done" : "")}>
      <span className="g">{t.t}</span>
      <span className="m">
        {new Date(t.due).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
      </span>
      <button className="b" onClick={() => onBump(t.id, -1)} aria-label="Minus one">
        −
      </button>
      <span className="m">
        {t.n}/{t.of}
      </span>
      <button className="b" onClick={() => onBump(t.id, 1)} aria-label="Plus one">
        +
      </button>
      {onEdit && (
        <button className="b" onClick={startEdit} aria-label="Edit task">
          Edit
        </button>
      )}
      <button className="b" onClick={() => onDelete(t.id)} aria-label="Delete task">
        Delete
      </button>
    </div>
  );
}
