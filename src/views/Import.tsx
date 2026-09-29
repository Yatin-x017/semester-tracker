import { C, TIME } from "../lib/model";
import type { ImpRow } from "../lib/ai";

const DAYS: [number, string][] = [[1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"]];
const PLATES: [string, string][] = [["lec", "Lecture"], ["lab", "Lab"]];

export default function Import({
  rows,
  setRows,
  onApply,
  onCancel,
}: {
  rows: ImpRow[];
  setRows: (r: ImpRow[]) => void;
  onApply: () => void;
  onCancel: () => void;
}) {
  const update = (i: number, field: keyof ImpRow, value: string) => {
    const next = rows.map((r, j) => (j === i ? { ...r, [field]: value } : r));
    setRows(next);
  };

  const remove = (i: number) => setRows(rows.filter((_, j) => j !== i));

  const apply = () => {
    const valid = rows.filter((r) => TIME.test(r.start));
    if (!valid.length) return;
    onApply();
  };

  return (
    <>
      <h1>Confirm timetable</h1>
      <p className="sub">Nothing is saved until you apply. Fix anything that looks wrong.</p>
      <table>
        <thead>
          <tr>
            <th>Day</th>
            <th>Start</th>
            <th>End</th>
            <th>Course</th>
            <th>Type</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>
                <select value={r.day} onChange={(e) => update(i, "day", e.target.value)}>
                  {DAYS.map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </td>
              <td>
                <input type="text" value={r.start} onChange={(e) => update(i, "start", e.target.value)} style={{ width: "5rem" }} />
              </td>
              <td>
                <input type="text" value={r.end} onChange={(e) => update(i, "end", e.target.value)} style={{ width: "5rem" }} />
              </td>
              <td>
                <select value={r.course} onChange={(e) => update(i, "course", e.target.value)}>
                  {Object.keys(C).map((c) => (
                    <option key={c} value={c}>{C[c]}</option>
                  ))}
                </select>
              </td>
              <td>
                <select value={r.plate} onChange={(e) => update(i, "plate", e.target.value)}>
                  {PLATES.map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </td>
              <td>
                <button className="b" onClick={() => remove(i)}>Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 12, display: "flex", gap: 6 }}>
        <button className="b on" onClick={apply}>Apply timetable</button>
        <button className="b" onClick={onCancel}>Cancel</button>
      </div>
    </>
  );
}


