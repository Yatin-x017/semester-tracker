import { useEffect, useRef, useState } from "react";
import {
  PSYS,
  SYS,
  actLabel,
  ask,
  buildCtx,
  parseActions,
  parseTimetable,
  runAct,
  stripActions,
  type ChatMsg,
  type ImpRow,
} from "../lib/ai";
import { waifuSay } from "../lib/bus";
import type { AppState } from "../lib/model";

interface ChatEntry {
  role: "user" | "assistant";
  text: string;
  actions?: { label: string; run: () => boolean }[];
}

interface Props {
  state: AppState;
  setState: (u: (s: AppState) => AppState) => void;
  viewing: string;
  authHeaders: () => Record<string, string>;
  onRows: (rows: ImpRow[]) => void;
  onUnauthorized: () => void;
}

export default function Assistant({ state, setState, viewing, authHeaders, onRows, onUnauthorized }: Props) {
  const [hist, setHist] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [hist]);

  const send = async () => {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);
    const nextHist: ChatMsg[] = [
      { role: "system", content: SYS + "\nContext: " + buildCtx(state, viewing) },
      ...hist.slice(-10).map((m) => ({ role: m.role, content: m.text }) as ChatMsg),
      { role: "user", content: q },
    ];
    setHist((h) => [...h, { role: "user", text: q }]);
    try {
      const text = await ask(nextHist, authHeaders());
      const acts = parseActions(text);
      const clean = stripActions(text) || (acts.length ? "Ready to apply:" : "");
      waifuSay(clean);
      setHist((h) => [
        ...h,
        {
          role: "assistant",
          text: clean,
          actions: acts.map((a) => ({
            label: actLabel(a),
            run: () => {
              // runAct validates and mutates the current state snapshot in place
              const ok = runAct(stateRef.current, a);
              if (ok) setState((s) => ({ ...s }));
              return ok;
            },
          })),
        },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "UNAUTHORIZED") onUnauthorized();
      setHist((h) => [...h, { role: "assistant", text: "Error: " + msg }]);
    } finally {
      setBusy(false);
    }
  };

  const pdfImport = async (f: File) => {
    setBusy(true);
    setHist((h) => [...h, { role: "assistant", text: "Reading " + f.name + "..." }]);
    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      const doc = await pdfjs.getDocument({ data: await f.arrayBuffer() }).promise;
      let txt = "";
      for (let i = 1; i <= doc.numPages && txt.length < 20000; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        txt += "\n[page " + i + "]\n" + content.items.map((x) => ("str" in x ? x.str : "")).join(" ");
      }
      if (txt.replace(/\[page \d+\]|\s/g, "").length < 20)
        throw new Error("No selectable text in this PDF (it may be a scan)");
      const raw = await ask([{ role: "system", content: PSYS }, { role: "user", content: txt }], authHeaders());
      const rows = parseTimetable(raw);
      setHist((h) => [...h, { role: "assistant", text: "Found " + rows.length + " class blocks. Check them in the main panel, then apply." }]);
      onRows(rows);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "UNAUTHORIZED") onUnauthorized();
      setHist((h) => [...h, { role: "assistant", text: "Import failed: " + msg }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="chat">
      <div ref={logRef} className="log" aria-live="polite">
        {hist.map((m, i) => (
          <div key={i} className={"msg" + (m.role === "user" ? " u" : "")}>
            {m.text}
            {m.actions?.map((a, j) => (
              <ApplyBtn key={j} a={a} />
            ))}
          </div>
        ))}
      </div>
      <textarea
        rows={2}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void send();
          }
        }}
        placeholder="Ask about your day, attendance or deadlines"
        aria-label="Message"
      />
      <div className="ar">
        <button className="b" onClick={() => void send()} disabled={busy || !input.trim()}>
          Send
        </button>
        <label className="b" style={{ cursor: "pointer" }}>
          Upload timetable PDF
          <input
            type="file"
            accept="application/pdf"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void pdfImport(f);
            }}
          />
        </label>
      </div>
    </div>
  );
}

function ApplyBtn({ a }: { a: { label: string; run: () => boolean } }) {
  const [applied, setApplied] = useState<null | boolean>(null);
  return (
    <span>
      <br />
      <button
        className="b"
        onClick={() => setApplied(a.run())}
        disabled={applied !== null}
      >
        {applied === null ? "Apply: " + a.label : applied ? "Applied" : "Could not apply"}
      </button>
    </span>
  );
}
