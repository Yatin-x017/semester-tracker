import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { CFG, HAS_SB } from "./config";
import { DEF_EVENTS, normState, type AppState } from "./model";
import { getToken, setToken } from "./token";

const LS_KEY = "sem3";
const BACKUP_KEY = "sem3_backup";

interface StoreCtx {
  state: AppState;
  setState: (updater: (s: AppState) => AppState) => void;
  view: string;
  setView: (v: string) => void;
  syncing: string;
  signedIn: boolean;
  authOpen: boolean;
  closeAuth: () => void;
  sb: SupabaseClient | null;
  authHeaders: () => Record<string, string>;
  signIn: (email: string) => Promise<string>;
  signOut: () => Promise<void>;
  skipSignIn: () => void;
  token: string;
  updateToken: (v: string) => void;
}

const Ctx = createContext<StoreCtx | null>(null);

export function useStore(): StoreCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore outside provider");
  return v;
}

function mergeSeeds(s: AppState): AppState {
  const have = new Set(s.ev.map((e) => e.d + "|" + e.t));
  for (const seed of DEF_EVENTS) {
    if (!have.has(seed.d + "|" + seed.t)) s.ev.push(JSON.parse(JSON.stringify(seed)));
  }
  return s;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setStateRaw] = useState<AppState>(() => {
    try {
      return normState(JSON.parse(localStorage.getItem(LS_KEY) || "null"));
    } catch {
      return normState(null);
    }
  });
  const [view, setView] = useState("today");
  const [syncing, setSyncing] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [authOpen, setAuthOpen] = useState(HAS_SB);
  const [skipped, setSkipped] = useState(false);
  const [token, setTokenState] = useState(getToken());

  const sb = useMemo<SupabaseClient | null>(() => {
    if (!HAS_SB || typeof window === "undefined") return null;
    try {
      return createClient(CFG.url, CFG.key);
    } catch {
      return null;
    }
  }, []);

  const stateRef = useRef(state);
  stateRef.current = state;
  const uidRef = useRef<string | null>(null);
  const sessRef = useRef<Session | null>(null);
  const tmr = useRef(0);

  const updateToken = useCallback((v: string) => {
    setToken(v);
    setTokenState(v);
  }, []);

  const push = useCallback(async () => {
    if (!sb || !uidRef.current) return;
    setSyncing("Saving...");
    const { error } = await sb
      .from("app_state")
      .upsert({ user_id: uidRef.current, data: stateRef.current, updated_at: new Date().toISOString() });
    setSyncing(error ? "Sync failed" : "Synced");
  }, [sb]);

  // Persist on every state change (localStorage immediately, cloud debounced).
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
    if (sb && uidRef.current) {
      clearTimeout(tmr.current);
      tmr.current = window.setTimeout(push, 800);
    }
  }, [state, sb, push]);

  const setState = useCallback((updater: (s: AppState) => AppState) => {
    setStateRaw((prev) => {
      const next = updater(normState(prev));
      return next;
    });
  }, []);

  const sess = useCallback(
    async (s: Session | null) => {
      sessRef.current = s;
      if (!s) {
        uidRef.current = null;
        setSignedIn(false);
        setSyncing("Signed out");
        return;
      }
      if (uidRef.current === s.user.id) return;
      uidRef.current = s.user.id;
      setSignedIn(true);
      setAuthOpen(false);
      setSyncing("Loading...");
      const { data, error } = await sb!.from("app_state").select("data").eq("user_id", s.user.id).maybeSingle();
      if (error) {
        setSyncing("Offline, using this device");
        return;
      }
      if (data && data.data && Object.keys(data.data).length) {
        try {
          localStorage.setItem(BACKUP_KEY, JSON.stringify(stateRef.current));
        } catch {
          /* ignore */
        }
        const merged = mergeSeeds(normState(data.data));
        setStateRaw(merged);
        setSyncing("Synced");
      } else {
        await push();
      }
    },
    [sb, push]
  );

  useEffect(() => {
    if (!sb) {
      setSyncing("Saved on this device");
      return;
    }
    sb.auth.getSession().then(({ data }) => sess(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => {
      sess(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [sb, sess]);

  const authHeaders = useCallback((): Record<string, string> => {
    const h: Record<string, string> = {};
    if (sessRef.current) h.Authorization = "Bearer " + sessRef.current.access_token;
    return h;
  }, []);

  const signIn = useCallback(
    async (email: string) => {
      if (!sb) return "Sign-in unavailable (no Supabase config).";
      const { error } = await sb.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: location.origin, shouldCreateUser: false },
      });
      return error ? "Could not send: " + error.message : "Check your email for the sign-in link.";
    },
    [sb]
  );

  const signOut = useCallback(async () => {
    if (sb) await sb.auth.signOut();
  }, [sb]);

  const skipSignIn = useCallback(() => {
    setSkipped(true);
    setAuthOpen(false);
    setSyncing("Local only");
  }, []);

  const closeAuth = useCallback(() => setAuthOpen(false), []);

  const value = useMemo<StoreCtx>(
    () => ({
      state,
      setState,
      view,
      setView,
      syncing,
      signedIn,
      authOpen: authOpen && !skipped,
      closeAuth,
      sb,
      authHeaders,
      signIn,
      signOut,
      skipSignIn,
      token,
      updateToken,
    }),
    [state, setState, view, syncing, signedIn, authOpen, skipped, closeAuth, sb, authHeaders, signIn, signOut, skipSignIn, token, updateToken]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
