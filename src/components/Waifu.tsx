import { useCallback, useEffect, useRef, useState } from "react";
import VrmCanvas from "./waifu/VrmCanvas";
import Guide from "./waifu/Guide";
import type { VrmEngine } from "./waifu/engine";
import { saveVrmBlob, clearVrmBlob } from "../lib/vrmStore";
import { muted, setMuted, speak, setVoiceName } from "../lib/speech";

const POKES = [
  "Hm? Bold of you to touch me, my love.",
  "Ah— careful. I am not responsible for what happens when you tease me.",
  "You dare poke the Guardian Overseer? …Do it again.",
  "Such naughty hands. Shall I bind them for you?",
  "Tch. I am no doll to be poked… well? I did not say stop.",
  "Every touch is mine, you know — including yours.",
  "If you want my attention, my love, you need only ask.",
  "Is this how you court ruin? How charming.",
];

interface Props {
  greeting: string;
  onClose: () => void;
}

export default function Waifu({ greeting, onClose }: Props) {
  const panelRef = useRef<HTMLElement>(null);
  const engineRef = useRef<VrmEngine | null>(null);
  const bubbleTimer = useRef(0);
  const lastPoke = useRef(-1);
  const fileRef = useRef<HTMLInputElement>(null);

  const [bubble, setBubble] = useState("");
  const [status, setStatus] = useState("Loading model…");
  const [hasCustom, setHasCustom] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [voice, setVoice] = useState<"aria" | "gothic" | "none">(() => {
    try {
      return (localStorage.getItem("vfvoice") as "aria" | "gothic" | "none") || "aria";
    } catch {
      return "aria";
    }
  });

  const say = useCallback((t: string, quiet = false) => {
    setBubble(t);
    clearTimeout(bubbleTimer.current);
    bubbleTimer.current = window.setTimeout(() => setBubble(""), 6000);
    if (!quiet && t && !/^(Loading|Waifu failed|Sample)/.test(t)) speak(t);
  }, []);

  const sayBubble = useCallback(
    (t: string, quiet = false) => {
      say(t, quiet);
      // animate the mouth a bit
      const len = t.length;
      engineRef.current?.setTalk(Math.min(5, 1 + len / 45));
    },
    [say]
  );

  // Greet on mount
  useEffect(() => {
    const id = window.setTimeout(() => sayBubble(greeting), 600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const poke = useCallback(
    (dx: number) => {
      const i0 = Math.floor(Math.random() * POKES.length);
      const i = i0 === lastPoke.current ? (i0 + 1) % POKES.length : i0;
      lastPoke.current = i;
      engineRef.current?.poke(dx);
      sayBubble(POKES[i]);
    },
    [sayBubble]
  );

  const loadVrmFile = useCallback(
    async (f: File) => {
      if (!f.name.toLowerCase().endsWith(".vrm")) {
        setStatus("Please pick a .vrm file");
        return;
      }
      try {
        setStatus("Saving model…");
        await saveVrmBlob(f);
        setStatus("Model saved. Reloading…");
        setHasCustom(true);
        sayBubble("So you made me anew? Give me a moment to change.", true);
        // reload canvas by remounting
        window.setTimeout(() => window.location.reload(), 800);
        sayBubble("So you made me anew? Give me a moment to change.");
      } catch (err) {
        setStatus("Save failed: " + (err instanceof Error ? err.message : String(err)));
      }
    },
    [sayBubble]
  );

  const clearCustom = useCallback(async () => {
    await clearVrmBlob();
    setHasCustom(false);
    window.location.reload();
  }, []);

  return (
    <section
      ref={panelRef}
      id="vrm"
      aria-label="Waifu companion"
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("button, .vrm-guide, input")) return;
        const r = panelRef.current!.getBoundingClientRect();
        poke((e.clientX - r.left) / r.width - 0.5);
      }}
    >
      <div className="vt">
        <span className="g">Waifu</span>
        <button onClick={() => setShowGuide((s) => !s)} title="How to make Albedo in VRoid Studio">Guide</button>
        <button onClick={() => fileRef.current?.click()} title="Load your Albedo .vrm">Load VRM</button>
        {hasCustom && (
          <button onClick={() => void clearCustom()} title="Remove your model, use the sample again">Reset</button>
        )}
        <button
          onClick={() => {
            const v = voice === "none" ? "aria" : voice === "aria" ? "gothic" : "none";
            setVoice(v);
            setVoiceName(v);
          }}
          title="Waifu voice persona"
        >
          {voice === "none" ? "Silent" : voice === "aria" ? "Aria" : "Gothic"}
        </button>
        <button
          onClick={() => {
            setMuted(!muted());
            if (muted()) sayBubble("Silence, then. As you wish.", true);
          }}
          title="Mute waifu voice"
        >
          {muted() ? "Unmute" : "Mute"}
        </button>
        <button onClick={onClose} title="Close">×</button>
        <input
          ref={fileRef}
          type="file"
          accept=".vrm,model/gltf-binary"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void loadVrmFile(f);
          }}
        />
      </div>
      <VrmCanvas onStatus={setStatus} onEngine={(e) => (engineRef.current = e)} onLoaded={() => setHasCustom(true)} />
      {bubble && <div className="vb">{bubble}</div>}
      <div className="vrm-status">{status}</div>
      {showGuide && <Guide />}
    </section>
  );
}
