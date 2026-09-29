import { useEffect, useRef } from "react";
import { VrmEngine } from "./engine";
import { loadVrmBlob } from "../../lib/vrmStore";

const FALLBACK_VRM =
  "https://cdn.jsdelivr.net/gh/pixiv/three-vrm@v3.4.2/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm";

interface Props {
  onStatus: (s: string) => void;
  onEngine: (e: VrmEngine | null) => void;
  onLoaded: (custom: boolean) => void;
}

export default function VrmCanvas({ onStatus, onEngine, onLoaded }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let engine: VrmEngine | null = null;
    let objectUrl: string | null = null;

    const boot = async () => {
      engine = new VrmEngine(mount);
      onEngine(engine);

      let url = FALLBACK_VRM;
      let custom = false; // custom models keep their own colors; sample gets recolored
      let source = "sample";
      try {
        const blob = await loadVrmBlob();
        if (blob) {
          url = URL.createObjectURL(blob);
          objectUrl = url;
          custom = true;
          source = "stored";
        }
      } catch {
        /* fall back to sample */
      }
      // Dev convenience: drop any albedo.vrm into ~/Downloads and refresh —
      // the dev server serves it at /albedo.vrm.
      if (!custom && import.meta.env.DEV) {
        try {
          const probe = await fetch("/albedo.vrm", { method: "HEAD" });
          if (probe.ok) {
            url = "/albedo.vrm";
            custom = true;
            source = "downloads";
          }
        } catch {
          /* ignore */
        }
      }

      try {
        onStatus(custom ? "Loading your Albedo…" : "Loading sample model…");
        await engine.loadModel(url, custom);
        if (disposed) {
          engine.dispose();
          return;
        }
        onStatus(
          custom
            ? source === "downloads"
              ? "Albedo (from your Downloads/albedo.vrm)"
              : "Albedo — your model"
            : "Sample model — use Load VRM / URL to add yours"
        );
        onLoaded(custom);
        engine.start();
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      } catch (err) {
        onStatus("Waifu failed to load: " + (err instanceof Error ? err.message : String(err)));
      }
    };

    void boot();
    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      engine?.dispose();
      onEngine(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={mountRef} className="vrm-mount" />;
}
