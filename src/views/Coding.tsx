import { back, norm, td, uid4, type AppState, type CodeEntry } from "../lib/model";

function strip(entries: CodeEntry[]): React.ReactNode {
  const cells: React.ReactNode[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = back(i);
    const n = entries.filter((e) => e.d === d).length;
    cells.push(
      <span
        key={d}
        title={`${d}: ${n}`}
        style={{
          display: "inline-block",
          width: 14,
          height: 14,
          marginRight: 3,
          borderRadius: 2,
          background: n ? "var(--ok)" : "var(--hover)",
          opacity: n ? Math.min(1, 0.4 + n * 0.2) : 1,
        }}
      />
    );
  }
  return cells;
}

function streak(entries: CodeEntry[]): number {
  const has = (d: string) => entries.some((e) => e.d === d);
  let i = has(td()) ? 0 : 1;
  let n = 0;
  while (has(back(i))) {
    n++;
    i++;
  }
  return n;
}

const wk = (l: CodeEntry[]) => l.filter((e) => e.d >= back(6)).length;

function Stat({ k, v }: { k: string; v: string | number }) {
  return (
    <span className="pill" style={{ marginRight: 6 }}>
      {k}: {v}
    </span>
  );
}

export default function Coding({ state, setState }: { state: AppState; setState: (u: (s: AppState) => AppState) => void }) {
  const { lc, cf, gh } = state.code;

  const add = (k: "lc" | "cf" | "gh", e: Omit<CodeEntry, "id">) =>
    setState((s) => ({ ...s, code: { ...s.code, [k]: [...s.code[k], { ...e, id: uid4() }] } }));

  const del = (k: "lc" | "cf" | "gh", id: string) =>
    setState((s) => ({ ...s, code: { ...s.code, [k]: s.code[k].filter((e) => e.id !== id) } }));

  const setRating = (v: string) => setState((s) => ({ ...s, code: { ...s.code, rating: v.slice(0, 4) } }));

  const dif = (x: string) => lc.filter((e) => e.x === x).length;
  const rated = cf.filter((e) => Number(e.x));
  const avgR = rated.length ? Math.round(rated.reduce((a, e) => a + (+e.x || 0), 0) / rated.length) : "none";
  const commits = gh.reduce((a, e) => a + (+(e.n ?? 0) || 0), 0);

  const entries = (k: "lc" | "cf" | "gh") =>
    [...state.code[k]]
      .sort((a, b) => b.d.localeCompare(a.d))
      .slice(0, 8)
      .map((e) => (
        <div className="row" key={e.id}>
          <span className="m">{e.d}</span>
          <span className="g">{e.t}</span>
          <span className="m">{e.x}</span>
          <button className="b" onClick={() => del(k, e.id)} aria-label="Delete entry">Delete</button>
        </div>
      )) || [];

  return (
    <>
      <h1>Coding</h1>
      <p className="sub">Log by hand. This page can't read your accounts live.</p>

      <h2>LeetCode</h2>
      <div>
        <Stat k="Solved" v={lc.length} />
        <Stat k="Easy" v={dif("Easy")} />
        <Stat k="Medium" v={dif("Medium")} />
        <Stat k="Hard" v={dif("Hard")} />
        <Stat k="Last 7 days" v={wk(lc)} />
        <Stat k="Streak" v={streak(lc) + " days"} />
      </div>
      <p style={{ margin: "8px 0" }}>{strip(lc)}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const t = String(f.get("t") || "").trim();
          const d = String(f.get("d") || td());
          if (!t) return;
          add("lc", { d, t: norm(t), x: String(f.get("x") || "Easy") });
          e.currentTarget.reset();
        }}
      >
        <input type="text" name="t" placeholder="Problem, e.g. Two Sum" required />
        <select name="x" defaultValue="Medium">
          <option>Easy</option>
          <option>Medium</option>
          <option>Hard</option>
        </select>
        <input type="date" name="d" defaultValue={td()} />
        <button className="b">Log solve</button>
      </form>
      {entries("lc")}

      <h2>Codeforces</h2>
      <div>
        <Stat k="Solved" v={cf.length} />
        <Stat k="Avg problem rating" v={avgR} />
        <Stat k="Last 7 days" v={wk(cf)} />
        <Stat k="Streak" v={streak(cf) + " days"} />
      </div>
      <div className="row">
        <label className="g" htmlFor="cf-rating">Current rating</label>
        <input
          id="cf-rating"
          type="number"
          min={0}
          value={state.code.rating}
          onChange={(e) => setRating(e.target.value)}
          style={{ width: "6rem" }}
        />
      </div>
      <p style={{ margin: "8px 0" }}>{strip(cf)}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const t = String(f.get("t") || "").trim();
          const d = String(f.get("d") || td());
          if (!t) return;
          add("cf", { d, t: norm(t), x: String(f.get("x") || ""), k: String(f.get("k") || "Practice") });
          e.currentTarget.reset();
        }}
      >
        <input type="text" name="t" placeholder="Problem, e.g. 1900A" required />
        <input type="number" name="x" placeholder="Rating" min={800} step={100} style={{ width: "6rem" }} />
        <select name="k" defaultValue="Practice">
          <option>Practice</option>
          <option>Contest</option>
        </select>
        <input type="date" name="d" defaultValue={td()} />
        <button className="b">Log solve</button>
      </form>
      {entries("cf")}

      <h2>GitHub</h2>
      <div>
        <Stat k="Commits logged" v={commits} />
        <Stat k="Active days" v={new Set(gh.map((e) => e.d)).size} />
        <Stat k="Streak" v={streak(gh) + " days"} />
      </div>
      <p style={{ margin: "8px 0" }}>
        {strip(gh)}{" "}
        <a href="https://github.com/Yatin-x017" target="_blank" rel="noopener noreferrer" style={{ color: "var(--acc)" }}>
          Open profile
        </a>
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const t = String(f.get("t") || "").trim();
          const d = String(f.get("d") || td());
          const n = Math.max(1, parseInt(String(f.get("n") || "1"), 10) || 1);
          if (!t) return;
          add("gh", { d, t: norm(t), x: n + " commits", n });
          e.currentTarget.reset();
        }}
      >
        <input type="text" name="t" placeholder="Repo or note" required />
        <input type="number" name="n" min={1} defaultValue={1} style={{ width: "5rem" }} aria-label="Commits" />
        <input type="date" name="d" defaultValue={td()} />
        <button className="b">Log commits</button>
      </form>
      {entries("gh")}
    </>
  );
}


