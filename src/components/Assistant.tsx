import { useCallback, useEffect, useRef, useState } from "react";
import {
  PSYS,
  SYS,
  actLabel,
  ask,
  askStream,
  buildCtx,
  cleanReply,
  parseActions,
  parseTimetable,
  runAct,
  type Act,
  type ChatMsg,
  type ImpRow,
} from "../lib/ai";
import { waifuSay } from "../lib/bus";
import type { AppState } from "../lib/model";

interface ChatEntry {
  role: "user" | "assistant";
  text: string;
  acts?: Act[];
}

interface Props {
  state: AppState;
  setState: (u: (s: AppState) => AppState) => void;
  viewing: string;
  authHeaders: () => Record<string, string>;
  onRows: (rows: ImpRow[]) => void;
  onUnauthorized: () => void;
  onClose?: () => void;
}

const CHAT_KEY = "sem3_chat";
const MAX_HIST = 60;

/** Restore the chat from this session (kept out of localStorage to avoid unbounded growth). */
function loadHist(): ChatEntry[] {
  try {
    const raw = JSON.parse(sessionStorage.getItem(CHAT_KEY) || "null");
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(
        (m): m is ChatEntry =>
          !!m && typeof m === "object" && (m.role === "user" || m.role === "assistant") && typeof m.text === "string"
      )
      .slice(-MAX_HIST);
  } catch {
    return [];
  }
}

export default function Assistant({ state, setState, viewing, authHeaders, onRows, onUnauthorized, onClose }: Props) {
  const [hist, setHist] = useState<ChatEntry[]>(loadHist);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const streamRef = useRef("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [hist, streaming, busy]);

  useEffect(() => {
    try {
      sessionStorage.setItem(CHAT_KEY, JSON.stringify(hist.slice(-MAX_HIST)));
    } catch {
      /* ignore */
    }
  }, [hist]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setHist([]);
    setStreaming("");
  }, []);

  const runAction = useCallback(
    (a: Act): boolean => {
      const next = runAct(stateRef.current, a);
      if (!next) return false;
      setState(() => next);
      return true;
    },
    [setState]
  );

  const send = async () => {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);
    setStreaming("");
    streamRef.current = "";
    const nextHist: ChatMsg[] = [
      { role: "system", content: SYS + "\nContext: " + buildCtx(stateRef.current, viewing) },
      ...hist.slice(-10).map((m) => ({ role: m.role, content: m.text }) as ChatMsg),
      { role: "user", content: q },
    ];
    setHist((h) => [...h, { role: "user", text: q }]);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const raw = await askStream(
        nextHist,
        authHeaders(),
        (text) => {
          streamRef.current = text;
          setStreaming(text);
        },
        ac.signal
      );
      const acts = parseActions(raw);
      const clean = cleanReply(raw) || (acts.length ? "Ready to apply:" : "");
      waifuSay(clean);
      setHist((h) => [...h, { role: "assistant", text: clean, acts }]);
    } catch (err) {
      const partial = streamRef.current;
      if (ac.signal.aborted) {
        if (partial.trim()) setHist((h) => [...h, { role: "assistant", text: partial }]);
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === "UNAUTHORIZED") {
          onUnauthorized();
          setHist((h) => [
            ...h,
            { role: "assistant", text: "I need the app token before I can speak. Open Settings and enter it." },
          ]);
        } else {
          setHist((h) => [...h, { role: "assistant", text: "Error: " + msg }]);
        }
      }
    } finally {
      setBusy(false);
      setStreaming("");
      abortRef.current = null;
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
      setHist((h) => [
        ...h,
        { role: "assistant", text: "Found " + rows.length + " class blocks. Check them in the main panel, then apply." },
      ]);
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
      <div className="chat-head">
        <span className="g">Albedo</span>
        {hist.length > 0 && (
          <button className="b" onClick={clear} title="Clear the conversation">
            Clear
          </button>
        )}
        {onClose && (
          <button className="b chat-close" onClick={onClose} aria-label="Close assistant" title="Close">
            ×
          </button>
        )}
      </div>
      <div ref={logRef} className="log" aria-live="polite">
        {hist.length === 0 && !busy && (
          <div className="sub">Ask about your day, attendance or deadlines. I can log classes and add tasks or events.</div>
        )}
        {hist.map((m, i) => (
          <div key={i} className={"msg" + (m.role === "user" ? " u" : "")}>
            {m.text}
            {m.acts?.map((a, j) => (
              <ApplyBtn key={j} a={a} onRun={runAction} />
            ))}
          </div>
        ))}
        {busy && (
          <div className="msg">
            {streaming || (
              <span className="thinking" aria-label="Thinking">
                <i />
                <i />
                <i />
              </span>
            )}
          </div>
        )}
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
        {busy ? (
          <button className="b" onClick={() => abortRef.current?.abort()}>
            Stop
          </button>
        ) : (
          <button className="b" onClick={() => void send()} disabled={!input.trim()}>
            Send
          </button>
        )}
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

function ApplyBtn({ a, onRun }: { a: Act; onRun: (a: Act) => boolean }) {
  const [applied, setApplied] = useState<null | boolean>(null);
  return (
    <span>
      <br />
      <button className="b" onClick={() => setApplied(onRun(a))} disabled={applied !== null}>
        {applied === null ? "Apply: " + actLabel(a) : applied ? "Applied" : "Could not apply"}
      </button>
    </span>
  );
}
