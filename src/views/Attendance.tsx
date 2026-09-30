import { useState } from "react";
import { C, POL, SEED, TH, avg, counts, f1, st, type AppState } from "../lib/model";

export default function Attendance({ state, setState }: { state: AppState; setState: (u: (s: AppState) => AppState) => void }) {
  const [saved, setSaved] = useState(false);
  const T = TH(state);

  const setPolicy = (v: string) => {
    setState((s) => ({ ...s, pol: v }));
    setSaved(true);
  };

  return (
    <>
      <h1>Attendance</h1>
      <p className="sub">
        Each course is the average of its lecture and lab percentages. Your target is {T}% — the minimum to sit for exams.
      </p>
      <div className="row">
        <span className="g">
          Leeway status (handbook: 75% minimum · 60–74% needs prior approval for university duties · 50–59% medical or
          Venture Studio only · below 50% = course fail)
        </span>
        <select value={state.pol || "std"} onChange={(e) => setPolicy(e.target.value)}>
          {POL.map(([v, label]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </select>
      </div>
      {saved && <p className="hint">Saved.</p>}
      <table>
        <thead>
          <tr>
            <th>Course</th>
            <th>Lecture</th>
            <th>Lab</th>
            <th>Overall</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(C).map((c) => {
            const l = counts(state, c, "lec");
            const b = SEED[c].lab ? counts(state, c, "lab") : null;
            const x = avg(state, c);
            const [label, cls] = st(state, c, x);
            return (
              <tr key={c}>
                <td>{C[c]}</td>
                <td className="m">{l[0]}/{l[1]}</td>
                <td className="m">{b ? `${b[0]}/${b[1]}` : "none"}</td>
                <td className="m">{f1(x)}%</td>
                <td>
                  <span className={"pill " + cls}>{label}</span>
                </td>
              </tr>
  );
          })}
        </tbody>
      </table>
    </>
  );
}
