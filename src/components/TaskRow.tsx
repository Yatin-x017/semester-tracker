import type { Task } from "../lib/model";

export default function TaskRow({
  t,
  onBump,
  onDelete,
}: {
  t: Task;
  onBump: (id: string, d: number) => void;
  onDelete: (id: string) => void;
}) {
  const done = t.n >= t.of;
  return (
    <div className={"row" + (done ? " done" : "")}>
      <span className="g">{t.t}</span>
      <span className="m">
        {new Date(t.due).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
      </span>
      <button className="b" onClick={() => onBump(t.id, -1)} aria-label="Minus one">−</button>
      <span className="m">{t.n}/{t.of}</span>
      <button className="b" onClick={() => onBump(t.id, 1)} aria-label="Plus one">+</button>
      <button className="b" onClick={() => onDelete(t.id)} aria-label="Delete task">Delete</button>
    </div>
  );
}
