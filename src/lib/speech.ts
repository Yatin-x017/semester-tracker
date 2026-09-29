// Waifu voice: Web Speech API with voice pooling per persona.
export function muted(): boolean {
  try {
    return localStorage.getItem("vfmute") === "1";
  } catch {
    return false;
  }
}

export function setMuted(m: boolean): void {
  try {
    localStorage.setItem("vfmute", m ? "1" : "0");
  } catch {
    /* ignore */
  }
  if (m && "speechSynthesis" in window) speechSynthesis.cancel();
}

export function voiceName(): string {
  try {
    return localStorage.getItem("vfvoice") || "aria";
  } catch {
    return "aria";
  }
}

export function setVoiceName(v: string): void {
  try {
    localStorage.setItem("vfvoice", v);
  } catch {
    /* ignore */
  }
}

/** Speak a line with the configured persona. No-ops when muted/silent/unsupported. */
export function speak(text: string, mode = voiceName()): void {
  if (muted() || mode === "none" || typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/—/g, ", ").slice(0, 300));
    const vs = speechSynthesis.getVoices();
    if (vs.length) {
      const dark = /daniel|george|reed|whisper|albert|zarvox|shelley|moira|tessa|fiona/i;
      const fem = /aria|zenika|uk english female|karen|serena|samantha|zira|female/i;
      const pool = mode === "gothic" ? vs.filter((v) => dark.test(v.name)) : vs.filter((v) => fem.test(v.name));
      const pick = pool[0] || vs.find((v) => /^en/i.test(v.lang)) || vs[0];
      if (pick) u.voice = pick;
    }
    u.rate = mode === "gothic" ? 0.82 : 0.86;
    u.pitch = mode === "gothic" ? 0.6 : 0.72;
    u.volume = 0.95;
    speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}
